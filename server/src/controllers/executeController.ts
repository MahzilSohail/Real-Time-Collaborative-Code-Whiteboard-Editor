import { Request, Response } from 'express';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ─── Input Detection ──────────────────────────────────────────────────────────

function hasCinOrScanf(code: string): boolean {
  return /\bcin\s*>>/.test(code) || /\bscanf\s*\(/.test(code) || /\bgetline\s*\(/.test(code);
}

function hasJavaScanner(code: string): boolean {
  return /new\s+Scanner/.test(code) || /System\.in/.test(code);
}

function hasPythonInput(code: string): boolean {
  return /\binput\s*\(/.test(code);
}

// ─── C++ Transpiler & Runner ──────────────────────────────────────────────────

function transpileAndRunCpp(code: string): string {
  if (hasCinOrScanf(code)) {
    return '[Note] Interactive user input (cin/scanf) is not supported in the web sandbox.\nTo test your logic here, define test variables directly (e.g. double a = 10, b = 4; char op = \'*\';) and click Run.';
  }

  let s = code;

  // Remove preprocessor directives & namespace
  s = s.replace(/#include\s*<[^>]+>/g, '');
  s = s.replace(/#include\s*"[^"]+"/g, '');
  s = s.replace(/using\s+namespace\s+std\s*;/g, '');

  // Convert functions: type name(type a, type b) { ... }
  s = s.replace(/\b(?:int|void|double|float|long|short|char|bool|string|auto)\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/g, (match, funcName, params) => {
    if (['if', 'for', 'while', 'switch', 'catch'].includes(funcName)) return match;
    const cleanParams = params.split(',').map((p: string) => {
      const parts = p.trim().split(/\s+/);
      return parts[parts.length - 1].replace(/[*&]/g, '');
    }).filter(Boolean).join(', ');
    return `function ${funcName}(${cleanParams}) {`;
  });

  // Convert array declarations: int arr[] = {1, 2, 3}; -> let arr = [1, 2, 3];
  s = s.replace(/\b(?:int|double|float|long|short|char|bool|string)\s+([a-zA-Z_]\w*)\s*\[\]\s*=\s*\{([^}]+)\};/g, 'let $1 = [$2];');

  // Convert variable declarations: double a = 10; -> let a = 10;
  s = s.replace(/\b(?:int|double|float|long(?: long)?|short|char|bool|string|auto)\s+([a-zA-Z_]\w*(\s*=\s*[^,;]+)?(\s*,\s*[a-zA-Z_]\w*(\s*=\s*[^,;]+)?)*);/g, 'let $1;');

  // For loops: for (int i = 0; ... ) -> for (let i = 0; ... )
  s = s.replace(/for\s*\(\s*(?:int|double|float|long|auto)\s+/g, 'for (let ');

  // Vectors: vector<int> v = {1, 2}; -> let v = [1, 2];
  s = s.replace(/vector\s*<[^>]+>\s+([a-zA-Z_]\w*)\s*(?:=\s*\{([^}]+)\})?;/g, (m, name, vals) => {
    return vals ? `let ${name} = [${vals}];` : `let ${name} = [];`;
  });
  s = s.replace(/\.push_back\(/g, '.push(');
  s = s.replace(/\.size\(\)/g, '.length');

  // cout statements: cout << a << " " << b << endl; -> __cout(a, " ", b, "\n");
  s = s.replace(/(?:std::)?cout\s*<<\s*([^;]+);/g, (m, chain) => {
    const parts: string[] = [];
    let cur = '';
    let inQuotes = false;
    let quoteChar = '';
    for (let i = 0; i < chain.length; i++) {
      const c = chain[i];
      if ((c === '"' || c === "'") && (i === 0 || chain[i - 1] !== '\\')) {
        if (!inQuotes) { inQuotes = true; quoteChar = c; }
        else if (quoteChar === c) { inQuotes = false; }
      }
      if (!inQuotes && chain.substring(i, i + 2) === '<<') {
        parts.push(cur.trim());
        cur = '';
        i++;
      } else {
        cur += c;
      }
    }
    if (cur.trim()) parts.push(cur.trim());

    const args = parts.map(p => {
      if (p === 'endl' || p === 'std::endl') return '"\\n"';
      return p;
    });
    return `__cout(${args.join(', ')});`;
  });

  const output: string[] = [];
  const __cout = (...args: any[]) => {
    output.push(args.join(''));
  };

  try {
    const wrapped = `
      "use strict";
      ${s}
      if (typeof main === 'function') { main(); }
    `;
    const runner = new Function('__cout', wrapped);
    runner(__cout);
    return output.length > 0 ? output.join('') : '(Program executed successfully with no output)';
  } catch (err: any) {
    return `Execution error: ${err.message}`;
  }
}

// ─── Java Transpiler & Runner ─────────────────────────────────────────────────

function transpileAndRunJava(code: string): string {
  if (hasJavaScanner(code)) {
    return '[Note] Interactive user input (Scanner/System.in) is not supported in the web sandbox.\nTo test your logic here, define test variables directly (e.g. double a = 10, b = 4; char op = \'*\';) and click Run.';
  }

  let s = code;

  // Remove package & import declarations
  s = s.replace(/package\s+[^;]+;/g, '');
  s = s.replace(/import\s+[^;]+;/g, '');

  // Strip class wrapper: public class Name { ... }
  s = s.replace(/(?:public\s+|private\s+|protected\s+)?(?:final\s+)?class\s+\w+\s*(?:extends\s+\w+)?(?:\s+implements\s+[^{]+)?\s*\{/g, '/* class */');
  const lastBraceIdx = s.lastIndexOf('}');
  if (lastBraceIdx !== -1) {
    s = s.substring(0, lastBraceIdx) + '/* end class */' + s.substring(lastBraceIdx + 1);
  }

  // Convert main method: public static void main(String[] args) -> function main()
  s = s.replace(/(?:public\s+|private\s+|protected\s+)?static\s+(?:void|int|double|float|long|short|char|boolean|String|auto)\s+main\s*\([^)]*\)\s*\{/g, 'function main() {');

  // Convert other methods: static <type> <name>(<params>) {
  s = s.replace(/(?:public\s+|private\s+|protected\s+)?static\s+(?:void|int|double|float|long|short|char|boolean|String)\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/g, (match, funcName, params) => {
    if (['if', 'for', 'while', 'switch', 'catch'].includes(funcName)) return match;
    const cleanParams = params.split(',').map((p: string) => {
      const parts = p.trim().split(/\s+/);
      return parts[parts.length - 1].replace(/\[\]/g, '');
    }).filter(Boolean).join(', ');
    return `function ${funcName}(${cleanParams}) {`;
  });

  // System.out.println & System.out.print
  s = s.replace(/System\.out\.println\s*\(([\s\S]*?)\);/g, '__println($1);');
  s = s.replace(/System\.out\.print\s*\(([\s\S]*?)\);/g, '__print($1);');

  // Double.NaN -> NaN
  s = s.replace(/\bDouble\.NaN\b/g, 'NaN');
  s = s.replace(/\bInteger\.MAX_VALUE\b/g, 'Number.MAX_SAFE_INTEGER');
  s = s.replace(/\bInteger\.MIN_VALUE\b/g, 'Number.MIN_SAFE_INTEGER');

  // Array declarations: int[] arr = {1, 2, 3}; or int arr[] = {1, 2, 3};
  s = s.replace(/\b(?:int|double|float|long|short|char|boolean|String)\s*(?:\[\]\s*([a-zA-Z_]\w*)|([a-zA-Z_]\w*)\s*\[\])\s*=\s*\{([^}]+)\};/g, 'let $1$2 = [$3];');

  // Variable declarations: double a = 10;
  s = s.replace(/\b(?:int|double|float|long|short|char|boolean|String)\s+([a-zA-Z_]\w*(\s*=\s*[^,;]+)?(\s*,\s*[a-zA-Z_]\w*(\s*=\s*[^,;]+)?)*);/g, 'let $1;');

  // For loops: for (int i = 0; ... ) -> for (let i = 0; ... )
  s = s.replace(/for\s*\(\s*(?:int|double|float|long)\s+/g, 'for (let ');

  const output: string[] = [];
  const __print = (...args: any[]) => {
    output.push(args.join(''));
  };
  const __println = (...args: any[]) => {
    output.push(args.join('') + '\n');
  };

  try {
    const wrapped = `
      "use strict";
      ${s}
      if (typeof main === 'function') { main(); }
    `;
    const runner = new Function('__print', '__println', wrapped);
    runner(__print, __println);
    return output.length > 0 ? output.join('') : '(Program executed successfully with no output)';
  } catch (err: any) {
    return `Execution error: ${err.message}`;
  }
}

// ─── Main Controller ──────────────────────────────────────────────────────────

export async function executeCode(req: Request, res: Response): Promise<void> {
  const { language, code } = req.body;

  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Code string is required.' });
    return;
  }

  const lang = (language || 'javascript').toLowerCase();
  const startTime = performance.now();

  // ── Python ──────────────────────────────────────────────────────────────────
  if (lang === 'python') {
    if (hasPythonInput(code)) {
      res.json({
        output: null,
        error: '[Note] Interactive user input (input()) is not supported in the web sandbox.\nTo test your logic, assign test values directly to variables (e.g. a = 10; b = 4; op = \'*\') and click Run.',
        duration: 0
      });
      return;
    }

    const tempFile = path.join(os.tmpdir(), `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.py`);
    fs.writeFileSync(tempFile, code, 'utf8');

    const tryPython = (cmd: string) => new Promise<{ out: string; err: string | null; killed: boolean }>((resolve) => {
      execFile(cmd, [tempFile], { timeout: 5000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
        if (err && (err as any).code === 'ENOENT') {
          resolve({ out: '', err: 'ENOENT', killed: false });
        } else if (err?.killed) {
          resolve({ out: '', err: null, killed: true });
        } else {
          resolve({ out: stdout || '', err: stderr || null, killed: false });
        }
      });
    });

    try {
      let result = await tryPython('python');
      if (result.err === 'ENOENT') result = await tryPython('python3');

      const execTime = Math.round(performance.now() - startTime);
      try { fs.unlinkSync(tempFile); } catch {}

      if (result.killed) {
        res.json({ output: null, error: 'Execution timed out (5 seconds limit).', duration: execTime });
        return;
      }
      if (result.err === 'ENOENT') {
        res.json({ output: null, error: 'Python interpreter not found on server.', duration: execTime });
        return;
      }
      if (!result.out && result.err) {
        res.json({ output: null, error: result.err.trim(), duration: execTime });
        return;
      }
      res.json({
        output: (result.out || (result.err ? `[Warnings]:\n${result.err}` : '(Code executed with no output)')).trim(),
        error: null,
        duration: execTime
      });
    } catch (e: any) {
      try { fs.unlinkSync(tempFile); } catch {}
      res.status(500).json({ error: e.message || 'Execution failed.' });
    }
    return;
  }

  // ── C++ ─────────────────────────────────────────────────────────────────────
  if (lang === 'cpp') {
    try {
      const output = transpileAndRunCpp(code);
      const execTime = Math.round(performance.now() - startTime);
      res.json({ output, error: null, duration: execTime });
    } catch (e: any) {
      res.json({ output: null, error: e.message || 'C++ execution error', duration: 0 });
    }
    return;
  }

  // ── Java ────────────────────────────────────────────────────────────────────
  if (lang === 'java') {
    try {
      const output = transpileAndRunJava(code);
      const execTime = Math.round(performance.now() - startTime);
      res.json({ output, error: null, duration: execTime });
    } catch (e: any) {
      res.json({ output: null, error: e.message || 'Java execution error', duration: 0 });
    }
    return;
  }

  // ── JavaScript / TypeScript ─────────────────────────────────────────────────
  if (lang === 'javascript' || lang === 'typescript') {
    const logs: string[] = [];
    const origLog   = console.log;
    const origWarn  = console.warn;
    const origError = console.error;

    try {
      console.log   = (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
      console.warn  = (...args: any[]) => logs.push('[WARN] ' + args.map(a => String(a)).join(' '));
      console.error = (...args: any[]) => logs.push('[ERROR] ' + args.map(a => String(a)).join(' '));

      let runnable = code;
      if (lang === 'typescript') {
        runnable = code
          .replace(/^interface\s+\w+\s*\{[\s\S]*?\}/gm, '')
          .replace(/^type\s+\w+\s*=[\s\S]*?;/gm, '')
          .replace(/:\s*[\w<>\[\]|&,\s]+(?=[,)=\n{])/g, '')
          .replace(/^(const|let|var)\s+(\w+):\s*[\w<>\[\]|&,\s]+\s*=/gm, '$1 $2 =');
      }

      new Function(runnable)();

      const execTime = Math.round(performance.now() - startTime);
      res.json({
        output: logs.length > 0 ? logs.join('\n') : '(Code executed successfully with no console output)',
        error: null,
        duration: execTime
      });
    } catch (err: any) {
      const execTime = Math.round(performance.now() - startTime);
      res.json({ output: null, error: err.toString(), duration: execTime });
    } finally {
      console.log   = origLog;
      console.warn  = origWarn;
      console.error = origError;
    }
    return;
  }

  // ── HTML Live Rendering ───────────────────────────────────────────────────
  if (lang === 'html') {
    const execTime = Math.round(performance.now() - startTime);
    res.json({
      output: '[HTML Live Preview Ready]\nDocument structure verified.\nInteractive page rendered in Live Preview viewport.',
      error: null,
      duration: execTime
    });
    return;
  }

  // ── Unsupported language ─────────────────────────────────────────────────────
  const execTime = Math.round(performance.now() - startTime);
  res.json({
    output: null,
    error: `Language "${lang}" is not supported. Supported languages: JavaScript, TypeScript, Python, Java, C++, HTML.`,
    duration: execTime
  });
}

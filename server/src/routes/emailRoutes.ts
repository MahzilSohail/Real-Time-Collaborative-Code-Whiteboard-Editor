import { Router, Request, Response } from 'express';
import { emailHistory } from '../services/emailService.js';

const router = Router();

// Endpoint for development/testing to inspect recent mock/sent emails
router.get('/history', (req: Request, res: Response) => {
  res.json({ emails: emailHistory });
});

export default router;

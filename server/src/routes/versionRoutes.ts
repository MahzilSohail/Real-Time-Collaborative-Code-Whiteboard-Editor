import { Router } from 'express';
import { 
  getVersions, 
  createSnapshot, 
  restoreVersion 
} from '../controllers/versionController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { checkDocAccess } from '../middleware/roleMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/:id/versions', checkDocAccess('viewer'), getVersions);
router.post('/:id/versions', checkDocAccess('editor'), createSnapshot);
router.post('/:id/versions/:versionId/restore', checkDocAccess('editor'), restoreVersion);

export default router;

import { Router } from 'express';
import { 
  getDocuments, 
  getDocumentById, 
  createDocument, 
  updateDocument, 
  deleteDocument, 
  duplicateDocument,
  shareDocument,
  removeCollaborator,
  updateCollaboratorRole,
  updateAccessLevel
} from '../controllers/documentController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { checkDocAccess } from '../middleware/roleMiddleware.js';

const router = Router();

// Apply auth to all document routes
router.use(authenticate);

router.get('/', getDocuments);
router.post('/', createDocument);
router.get('/:id', checkDocAccess('viewer'), getDocumentById);
router.put('/:id', checkDocAccess('editor'), updateDocument);
router.delete('/:id', checkDocAccess('owner'), deleteDocument);
router.post('/:id/duplicate', checkDocAccess('viewer'), duplicateDocument);
router.post('/:id/share', checkDocAccess('owner'), shareDocument);
router.delete('/:id/collaborators/:userId', checkDocAccess('owner'), removeCollaborator);
router.put('/:id/collaborators/:userId', checkDocAccess('owner'), updateCollaboratorRole);
router.put('/:id/access', checkDocAccess('owner'), updateAccessLevel);

export default router;

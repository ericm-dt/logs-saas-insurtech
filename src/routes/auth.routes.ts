import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// Routes
router.post('/register', validate(registerValidation), authController.register.bind(authController));
router.post('/login', validate(loginValidation), authController.login.bind(authController));
router.get('/me', authenticate, authController.me.bind(authController));

export default router;

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, firstName, lastName, dateOfBirth, phone, address } = req.body;
    
    const customer = await prisma.customer.create({
      data: {
        email,
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        phone,
        street: address.street,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country || 'USA',
      },
    });

    res.status(201).json({ success: true, data: customer });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const customers = await prisma.customer.findMany();
    res.json({ success: true, data: customers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.customer.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true, message: 'Customer deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;

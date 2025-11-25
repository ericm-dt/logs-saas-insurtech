import { Request, Response } from 'express';
import { customerModel } from '../models/customer.model';
import { sendSuccess, sendError } from '../utils/response';

export class CustomerController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { email, firstName, lastName, dateOfBirth, phone, address } = req.body;

      const customer = await customerModel.create({
        email,
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        phone,
        address,
      });

      sendSuccess(res, customer, 'Customer created successfully', 201);
    } catch (error) {
      sendError(res, 'Failed to create customer', 500);
    }
  }

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const customers = await customerModel.findAll();
      sendSuccess(res, customers);
    } catch (error) {
      sendError(res, 'Failed to fetch customers', 500);
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const customer = await customerModel.findById(id);

      if (!customer) {
        sendError(res, 'Customer not found', 404);
        return;
      }

      sendSuccess(res, customer);
    } catch (error) {
      sendError(res, 'Failed to fetch customer', 500);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const customer = await customerModel.update(id, updates);

      if (!customer) {
        sendError(res, 'Customer not found', 404);
        return;
      }

      sendSuccess(res, customer, 'Customer updated successfully');
    } catch (error) {
      sendError(res, 'Failed to update customer', 500);
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await customerModel.delete(id);

      if (!deleted) {
        sendError(res, 'Customer not found', 404);
        return;
      }

      sendSuccess(res, null, 'Customer deleted successfully');
    } catch (error) {
      sendError(res, 'Failed to delete customer', 500);
    }
  }
}

export const customerController = new CustomerController();

import { Customer } from '../types/insuretech.types';
import { prisma } from '../config/database';

class CustomerModel {
  async create(customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const customer = await prisma.customer.create({
      data: {
        email: customerData.email,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        dateOfBirth: customerData.dateOfBirth,
        phone: customerData.phone,
        street: customerData.address.street,
        city: customerData.address.city,
        state: customerData.address.state,
        zipCode: customerData.address.zipCode,
        country: customerData.address.country,
      },
    });

    return this.mapToCustomer(customer);
  }

  async findById(id: string): Promise<Customer | undefined> {
    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    return customer ? this.mapToCustomer(customer) : undefined;
  }

  async findByEmail(email: string): Promise<Customer | undefined> {
    const customer = await prisma.customer.findUnique({
      where: { email },
    });

    return customer ? this.mapToCustomer(customer) : undefined;
  }

  async update(id: string, updates: Partial<Customer>): Promise<Customer | undefined> {
    try {
      const data: any = {};
      
      if (updates.email) data.email = updates.email;
      if (updates.firstName) data.firstName = updates.firstName;
      if (updates.lastName) data.lastName = updates.lastName;
      if (updates.dateOfBirth) data.dateOfBirth = updates.dateOfBirth;
      if (updates.phone) data.phone = updates.phone;
      
      if (updates.address) {
        if (updates.address.street) data.street = updates.address.street;
        if (updates.address.city) data.city = updates.address.city;
        if (updates.address.state) data.state = updates.address.state;
        if (updates.address.zipCode) data.zipCode = updates.address.zipCode;
        if (updates.address.country) data.country = updates.address.country;
      }

      const customer = await prisma.customer.update({
        where: { id },
        data,
      });

      return this.mapToCustomer(customer);
    } catch (error) {
      return undefined;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.customer.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async findAll(): Promise<Customer[]> {
    const customers = await prisma.customer.findMany();
    return customers.map(this.mapToCustomer);
  }

  private mapToCustomer(data: any): Customer {
    return {
      id: data.id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      phone: data.phone,
      address: {
        street: data.street,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        country: data.country,
      },
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}

export const customerModel = new CustomerModel();

import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Invalid customer');
    }

    const findedProducts = await this.productsRepository.findAllById(
      products.map(product => ({ id: product.id })),
    );

    const productsNotExists = products.filter(
      product =>
        !findedProducts
          .map(findedProduct => findedProduct.id)
          .includes(product.id),
    );

    if (productsNotExists.length !== 0) {
      const message = productsNotExists
        .map(product => `Invalid product: ${product.id} `)
        .reduce((total, next) => total + next, '');

      throw new AppError(message);
    }

    const quantityCheck = products.filter(
      product =>
        findedProducts.filter(
          findedProduct => findedProduct.id === product.id,
        )[0].quantity < product.quantity,
    );

    if (quantityCheck.length !== 0) {
      const message = quantityCheck
        .map(
          product =>
            `Quantity ${product.quantity} for product ${product.id} not available `,
        )
        .reduce((total, next) => total + next, '');

      throw new AppError(message);
    }

    const createProducts = products.map(product => ({
      product_id: product.id,
      price: findedProducts.filter(
        findedProduct => findedProduct.id === product.id,
      )[0].price,
      quantity: product.quantity,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: createProducts,
    });

    const updateProducts = products.map(product => ({
      id: product.id,
      quantity:
        findedProducts.filter(
          findedProduct => findedProduct.id === product.id,
        )[0].quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(updateProducts);

    return order;
  }
}

export default CreateOrderService;

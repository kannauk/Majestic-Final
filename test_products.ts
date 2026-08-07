
import { getProducts } from './src/services/products';

async function test() {
  try {
    const products = await getProducts();
    console.log('Products:', products);
  } catch (error) {
    console.error('Error fetching products:', error);
  }
}

test();

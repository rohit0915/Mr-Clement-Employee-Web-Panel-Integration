import type { OrderItem, PreparationStation } from '../types/order';

const burgerImages = [
  'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=400&q=80',
];
const beverageImages = [
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80', // lemonade
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80', // milkshake
  'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
];
const crispyImages = [
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=400&q=80', // crispy fried chicken
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80', // crispy fries
  'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
];
const nuggetImages = [
  'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=400&q=80',
];

const burgerNames = [
  'Spicy Burger', 'Classic Burger', 'Cheese Burger', 'Veggie Burger', 'Chicken Burger', 'Double Patty Burger', 'BBQ Burger', 'Fish Burger', 'Bacon Burger', 'Mushroom Burger'
];
const beverageNames = [
  'Cola', 'Lemonade', 'Iced Tea', 'Orange Juice', 'Milkshake', 'Coffee', 'Green Tea', 'Smoothie', 'Water', 'Energy Drink'
];
const crispyNames = [
  'Crispy Chicken', 'Crispy Wings', 'Crispy Tenders', 'Crispy Fries', 'Crispy Fish', 'Crispy Onion Rings', 'Crispy Nuggets', 'Crispy Shrimps', 'Crispy Calamari', 'Crispy Potato'
];
const nuggetNames = [
  'Chicken Nuggets', 'Fish Nuggets', 'Veggie Nuggets', 'Cheese Nuggets', 'Spicy Nuggets', 'BBQ Nuggets', 'Mini Nuggets', 'Crunchy Nuggets', 'Classic Nuggets', 'Herb Nuggets'
];

const menuItems: OrderItem[] = [
  ...burgerNames.map((name, i) => ({
    itemId: `burger${i + 1}`,
    name,
    quantity: 1,
    price: 330 + i * 10,
    availability: true,
    itemType: 'Burger',
    image: burgerImages[i % burgerImages.length],
    addOns: [],
    notes: '',
    size: 'Regular',
    preparationStation: 'Kitchen' as PreparationStation,
  })),
  ...beverageNames.map((name, i) => ({
    itemId: `beverage${i + 1}`,
    name,
    quantity: 1,
    price: 120 + i * 5,
    availability: true,
    itemType: 'Beverage',
    image: beverageImages[i % beverageImages.length],
    addOns: [],
    notes: '',
    size: 'Medium',
    preparationStation: 'Counter' as PreparationStation,
  })),
  ...crispyNames.map((name, i) => ({
    itemId: `crispy${i + 1}`,
    name,
    quantity: 1,
    price: 200 + i * 8,
    availability: true,
    itemType: 'Crispy',
    image: crispyImages[i % crispyImages.length],
    addOns: [],
    notes: '',
    size: 'Regular',
    preparationStation: 'Kitchen' as PreparationStation,
  })),
  ...nuggetNames.map((name, i) => ({
    itemId: `nugget${i + 1}`,
    name,
    quantity: 1,
    price: 150 + i * 7,
    availability: true,
    itemType: 'Nugget',
    image: nuggetImages[i % nuggetImages.length],
    addOns: [],
    notes: '',
    size: 'Small',
    preparationStation: 'Kitchen' as PreparationStation,
  })),
];

export const getMenuItems = async (): Promise<OrderItem[]> => {
  return Promise.resolve(menuItems);
}; 
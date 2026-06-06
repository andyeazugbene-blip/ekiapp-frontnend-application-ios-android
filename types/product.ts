export type ProductStatus = "active" | "draft" | "low_stock" | "out_of_stock";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: "GBP" | "USD" | "EUR" | "NGN" | "GHS" | "KES" | "CAD";
  priceNgn?: number;
  images: string[];
  category: string;
  vendorId: string;
  vendorUserId?: string;
  vendorName: string;
  vendorCity: string;
  stock: number;
  status: ProductStatus;
  weight?: number;
  unit?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  icon: string;
  count?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  productId?: string;
  vendorId?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  { id: "1", name: "Grains & Cereals", icon: "🌾" },
  { id: "2", name: "Palm Oil", icon: "🫒" },
  { id: "3", name: "Dried Fish", icon: "🐟" },
  { id: "4", name: "Spices & Herbs", icon: "🌿" },
  { id: "5", name: "Flours & Powders", icon: "🍚" },
  { id: "6", name: "Vegetables", icon: "🥬" },
  { id: "7", name: "Nuts & Seeds", icon: "🥜" },
  { id: "8", name: "Sauces & Pastes", icon: "🥫" },
];

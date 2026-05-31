import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Product } from "../../types/product";

interface ProductCardProps {
  product: Product;
  onPress?: () => void;
  onAddToCart?: () => void;
  variant?: "grid" | "list";
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  onAddToCart,
  variant = "grid",
}) => {
  const isGrid = variant === "grid";
  const price = `£${product.price.toFixed(2)}`;

  if (!isGrid) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.86} style={styles.listCard}>
        <Media product={product} size={72} radius={20} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>{product.vendorName}</Text>
          <Text style={styles.price}>{price}</Text>
        </View>
        {onAddToCart ? (
          <TouchableOpacity onPress={onAddToCart} activeOpacity={0.86} style={styles.cartRound}>
            <Ionicons name="add" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.86} style={styles.gridCard}>
      <View style={styles.imageWrap}>
        <Media product={product} size={132} radius={24} fill />
      </View>
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{product.vendorCity}</Text>
        <View style={styles.footer}>
          <Text style={styles.price}>{price}</Text>
          {onAddToCart ? (
            <TouchableOpacity onPress={onAddToCart} activeOpacity={0.86} style={styles.addButton}>
              <Ionicons name="cart-outline" size={14} color="#FFFFFF" />
              <Text style={styles.addCopy}>Add</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

function Media({ product, size, radius, fill = false }: { product: Product; size: number; radius: number; fill?: boolean }) {
  if (product.images[0]) {
    return (
      <Image
        source={{ uri: product.images[0] }}
        style={fill ? styles.imageFill : { width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.placeholder, fill ? styles.imageFill : { width: size, height: size, borderRadius: radius }]}>
      <Ionicons name="basket-outline" size={fill ? 34 : 26} color="#2E6957" />
    </View>
  );
}

const styles = StyleSheet.create({
  gridCard: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    shadowColor: "#282828",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
    overflow: "hidden",
  },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: 14,
    shadowColor: "#282828",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  imageWrap: {
    height: 132,
    backgroundColor: "#E9F4EE",
  },
  imageFill: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    backgroundColor: "#E9F4EE",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 14,
  },
  name: {
    color: "#102118",
    fontSize: 14,
    fontWeight: "800",
  },
  meta: {
    color: "#72857D",
    fontSize: 12,
    marginTop: 5,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  price: {
    color: "#076B51",
    fontSize: 16,
    fontWeight: "800",
  },
  addButton: {
    minHeight: 34,
    borderRadius: 14,
    backgroundColor: "#076B51",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  addCopy: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 5,
  },
  cartRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
});

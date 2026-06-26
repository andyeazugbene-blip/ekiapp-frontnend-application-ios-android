import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useOnboardingStore } from "../../stores/onboardingStore";
import { useAuthStore } from "../../stores/authStore";
import { productService } from "../../services/productService";
import { uploadService } from "../../services/uploadService";
import { ApiRequestError } from "../../services/api";
import { Product, PRODUCT_CATEGORIES } from "../../types/product";
import {
  FieldLabel,
  OnboardingHeader,
  OutlineButton,
  PrimaryButton,
  SelectBox,
} from "../../components/onboarding/FigmaNativeUI";

const CATEGORY_OPTIONS: string[] = PRODUCT_CATEGORIES.map((c) => c.name);
const STOCK_OPTIONS: string[] = ["1", "5", "10", "20", "50", "100", "250", "500"];

function parseMoneyInput(value: string): number {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  return Number(normalized) || 0;
}

export default function AddProductScreen() {
  const router = useRouter();
  const { updateFirstProduct, setFirstProductPublished } = useOnboardingStore();
  const { user } = useAuthStore();
  const vendor = user?.role === "vendor" ? user : null;

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("");
  const [weight, setWeight] = useState("");
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageRemoteUrl, setImageRemoteUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photo access needed", "Photo library access is required to upload an image.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageRemoteUrl(null);
      setUploading(true);

      const fileName = asset.fileName ?? `product_${Date.now()}.jpg`;
      const contentType = asset.mimeType ?? "image/jpeg";
      const publicUrl = await uploadService.uploadImage(asset.uri, fileName, contentType, "products");
      setImageRemoteUrl(publicUrl);
    } catch (err) {
      Alert.alert(
        "Could not upload image",
        err instanceof Error ? err.message : "Please try again."
      );
      setImageRemoteUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (asDraft = false) => {
    if (!name.trim()) {
      Alert.alert("Missing details", "Foodstuff name is required.");
      return;
    }
    if (!vendor) {
      Alert.alert("Vendor login required", "Please log in as a vendor to continue.");
      return;
    }

    updateFirstProduct({
      name: name.trim(),
      category: category || "General",
      price: price.trim(),
      stock: stock.trim(),
      weight: weight.trim(),
      description: description.trim(),
    });
    setFirstProductPublished(!asDraft);

    setSubmitting(true);
    try {
      const parsedPrice = parseMoneyInput(price);
      const parsedCostPrice = costPrice.trim() ? parseMoneyInput(costPrice) : undefined;
      const parsedStock = Number(stock.trim()) || 0;
      const parsedWeight = Number(weight.replace(/[^\d.]/g, "")) || 0;

      const payload: Omit<Product, "id" | "createdAt" | "updatedAt"> = {
        name: name.trim(),
        description: description.trim(),
        price: parsedPrice,
        costPrice: parsedCostPrice,
        currency: (vendor.currency ?? "GBP") as Product["currency"],
        images: imageRemoteUrl ? [imageRemoteUrl] : [],
        category: category || "General",
        vendorId: vendor.id,
        vendorName: vendor.storeName,
        vendorCity: vendor.city ?? "",
        stock: parsedStock,
        status: asDraft ? "draft" : "active",
        weight: parsedWeight,
        unit: "kg",
      };

      await productService.createProduct(payload);
      router.push("/(vendor-onboarding)/delivery-intro" as any);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 403) {
        router.push("/(vendor-onboarding)/delivery-intro" as any);
        return;
      }
      Alert.alert(
        "Could not save foodstuff",
        err instanceof Error ? err.message : "Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <OnboardingHeader
          activeSegments={3}
          compact
          subtitle="This is what buyers will see in your store"
          title="Add your first foodstuff"
        />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 36 }}
        >
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Add foodstuff</Text>

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.72}
              disabled={uploading || submitting}
              onPress={handlePickImage}
              style={styles.uploadArea}
            >
              {imageUri ? (
                <>
                  <Image source={{ uri: imageUri }} resizeMode="cover" style={styles.uploadedImage} />
                  {uploading ? (
                    <View style={styles.uploadOverlay}>
                      <ActivityIndicator color="#FFFFFF" />
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={styles.uploadIcon}>
                    <Ionicons name="cloud-upload-outline" size={20} color="#0A8062" />
                  </View>
                  <Text style={styles.uploadText}>Upload Image</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.fieldGroup}>
              <FieldLabel>Foodstuff name</FieldLabel>
              <TextInput
                onChangeText={setName}
                placeholder="e.g. Garri (Yellow)"
                placeholderTextColor="#858585"
                style={styles.input}
                value={name}
              />
            </View>

            <View style={styles.fieldGroup}>
              <FieldLabel>Category:</FieldLabel>
              <SelectBox
                value={category}
                options={CATEGORY_OPTIONS}
                onChange={setCategory}
                title="Select category"
                placeholder="Select"
              />
            </View>

            <View style={styles.row}>
              <View style={styles.priceField}>
                <FieldLabel>Price:</FieldLabel>
                <View style={styles.priceInputWrap}>
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setPrice}
                    placeholder="0.00"
                    placeholderTextColor="#858585"
                    style={styles.priceInput}
                    value={price}
                  />
                  <Ionicons name="chevron-down" size={18} color="#334653" />
                </View>
              </View>
              <View style={styles.stockField}>
                <FieldLabel>Stock quantity</FieldLabel>
                <SelectBox
                  value={stock}
                  options={STOCK_OPTIONS}
                  onChange={setStock}
                  title="Select stock quantity"
                  placeholder="Select"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <FieldLabel>Product cost (optional)</FieldLabel>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setCostPrice}
                placeholder="What this item costs you"
                placeholderTextColor="#858585"
                style={styles.input}
                value={costPrice}
              />
              <Text style={styles.helper}>Used only for estimated profit. Buyers never see this.</Text>
            </View>

            <View style={styles.fieldGroup}>
              <FieldLabel>Weight</FieldLabel>
              <TextInput
                onChangeText={setWeight}
                placeholder="e.g. 5kg"
                placeholderTextColor="#858585"
                style={styles.input}
                value={weight}
              />
              <Text style={styles.helper}>Weight is required to calculate delivery cost</Text>
            </View>

            <View style={styles.fieldGroup}>
              <FieldLabel>Store Description</FieldLabel>
              <TextInput
                multiline
                onChangeText={setDescription}
                placeholder="Add a short description buyers can understand..."
                placeholderTextColor="#858585"
                style={styles.description}
                textAlignVertical="top"
                value={description}
              />
            </View>

            <View style={styles.buttons}>
              <PrimaryButton
                disabled={uploading || submitting}
                onPress={() => handleSave(false)}
                title={submitting ? "Saving..." : "Save & Continue"}
              />
              <OutlineButton
                disabled={uploading || submitting}
                onPress={() => handleSave(true)}
                title="Save as Draft"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#076B51" },
  flex: { flex: 1 },
  scroll: { flex: 1, marginTop: -18 },
  card: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 28,
    minHeight: "100%",
  },
  sectionTitle: { color: "#1A1A1A", fontFamily: "Manrope-Bold", fontSize: 18, marginBottom: 16 },
  uploadArea: {
    height: 130,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(7,107,81,0.35)",
    borderStyle: "dashed",
    backgroundColor: "#E6F0ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    overflow: "hidden",
  },
  uploadIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#D0E3DD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  uploadText: { color: "#1A1A1A", fontFamily: "Outfit-Regular", fontSize: 14 },
  uploadedImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "center",
  },
  fieldGroup: { marginBottom: 16 },
  input: {
    height: 50,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    color: "#282828",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    paddingHorizontal: 18,
  },
  row: { flexDirection: "row", gap: 12, marginBottom: 16 },
  priceField: { flex: 1 },
  stockField: { flex: 1 },
  priceInputWrap: {
    height: 50,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 18,
    paddingRight: 16,
  },
  priceInput: {
    flex: 1,
    color: "#282828",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    paddingVertical: 0,
  },
  helper: {
    color: "#858585",
    fontFamily: "Outfit-Regular",
    fontSize: 12,
    marginTop: 6,
  },
  description: {
    minHeight: 110,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    color: "#282828",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  buttons: { gap: 12, marginTop: 6 },
});

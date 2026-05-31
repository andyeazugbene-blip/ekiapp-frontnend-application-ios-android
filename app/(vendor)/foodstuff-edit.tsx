import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { PRODUCT_CATEGORIES, Product } from "../../types/product";
import { useInventoryStore } from "../../stores/inventoryStore";
import { productService } from "../../services/productService";
import { uploadService } from "../../services/uploadService";
import { ApiRequestError } from "../../services/api";
import { deliveryService } from "../../services/deliveryService";


const UNITS = ["kg", "g", "lb", "oz", "pack", "bunch", "piece", "litre", "ml"];

export default function FoodstuffEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { selectedProduct, setSelectedProduct } = useInventoryStore();

  const [product, setProduct] = useState<Product | null>(selectedProduct);
  const [loading, setLoading] = useState(!selectedProduct);

  const [name, setName] = useState(selectedProduct?.name ?? "");
  const [category, setCategory] = useState(selectedProduct?.category ?? "");
  const [description, setDescription] = useState(selectedProduct?.description ?? "");
  const [price, setPrice] = useState(String(selectedProduct?.price ?? ""));
  const [weight, setWeight] = useState(String(selectedProduct?.weight ?? ""));
  const [unit, setUnit] = useState(selectedProduct?.unit ?? "kg");
  const [stock, setStock] = useState(String(selectedProduct?.stock ?? ""));
  const [isPublished, setIsPublished] = useState(selectedProduct?.status !== "draft");
  const [isAvailable, setIsAvailable] = useState(selectedProduct?.status !== "out_of_stock");
  const [imageUri, setImageUri] = useState<string | null>(selectedProduct?.images?.[0] ?? null);
  const [imageRemoteUrl, setImageRemoteUrl] = useState<string | null>(selectedProduct?.images?.[0] ?? null);

  const [showUnits, setShowUnits] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [hasDelivery, setHasDelivery] = useState(false);

  useEffect(() => {
    deliveryService.listZones()
      .then((zones) => setHasDelivery((zones ?? []).length > 0))
      .catch(() => setHasDelivery(false));
  }, []);


  // If we land here via a deep link, fetch the product directly.
  useEffect(() => {
    if (selectedProduct || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await productService.getById(id);
        if (cancelled) return;
        setProduct(p);
        setSelectedProduct(p);
        setName(p.name);
        setCategory(p.category);
        setDescription(p.description);
        setPrice(String(p.price));
        setWeight(String(p.weight ?? ""));
        setUnit(p.unit ?? "kg");
        setStock(String(p.stock));
        setIsPublished(p.status !== "draft");
        setIsAvailable(p.status !== "out_of_stock");
        setImageUri(p.images?.[0] ?? null);
        setImageRemoteUrl(p.images?.[0] ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load product.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, selectedProduct, setSelectedProduct]);

  const handlePickImage = async () => {
    setError("");
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Photo library access is required to upload an image.");
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
      setError(err instanceof Error ? err.message : "Could not upload image. Please try again.");
      setImageRemoteUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!product) return;
    setError("");
    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const status = !isPublished ? "draft" : !isAvailable ? "out_of_stock" : Number(stock) <= 5 ? "low_stock" : "active";

      const patch: Partial<Product> = {
        name: name.trim(),
        description: description.trim(),
        price: Number(price) || 0,
        category: category || product.category,
        stock: Number(stock) || 0,
        weight: Number(weight) || 0,
        unit,
        status,
        images: imageRemoteUrl ? [imageRemoteUrl] : product.images,
      };
      const updated = await productService.updateProduct(product.id, patch);
      setSelectedProduct(updated);
      router.back();
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 403) {
        Alert.alert(
          "Verification required",
          "You need to verify your account before publishing. Save as draft instead?",
          [
            { text: "Verify now", onPress: () => router.push("/(vendor-verification)" as any) },
            { text: "Save as draft", onPress: () => persistAsDraft() },
          ]
        );
        return;
      }
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSubmitting(false);
    }
  };

  const persistAsDraft = async () => {
    if (!product) return;
    setSubmitting(true);
    try {
      const updated = await productService.updateProduct(product.id, {
        name: name.trim(),
        description: description.trim(),
        price: Number(price) || 0,
        category: category || product.category,
        stock: Number(stock) || 0,
        weight: Number(weight) || 0,
        unit,
        status: "draft",
        images: imageRemoteUrl ? [imageRemoteUrl] : product.images,
      });
      setSelectedProduct(updated);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save draft.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!product) return;
    Alert.alert(
      "Delete this product?",
      `“${product.name}” will be permanently removed from your store.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await productService.deleteProduct(product.id);
              setSelectedProduct(null);
              router.back();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not delete product.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading || !product) {
    return (
      <View style={styles.page}>
        <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Foodstuff</Text>
            <Text style={styles.headerSubtitle}>{loading ? "Loading..." : "No product selected."}</Text>
          </View>
        </SafeAreaView>
        <View style={styles.placeholder}>
          {loading ? <ActivityIndicator color="#076B51" /> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Foodstuff</Text>
          <Text style={styles.headerSubtitle}>Update your foodstuff details.</Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Before this foodstuff goes live checklist banner (Figma) */}
          <View style={styles.checklistCard}>
            <Text style={styles.checklistTitle}>Before this foodstuff goes live</Text>
            <Text style={styles.checklistSubtitle}>Review the checklist to ensure a perfect listing.</Text>
            
            <View style={styles.checklistItem}>
              <Ionicons
                name={imageUri ? "checkmark-circle" : "ellipse-outline"}
                size={18}
                color={imageUri ? "#076B51" : "#858585"}
              />
              <Text style={[styles.checklistText, imageUri && styles.checklistTextDone]}>Image added</Text>
            </View>

            <View style={styles.checklistItem}>
              <Ionicons
                name={Number(price) > 0 ? "checkmark-circle" : "ellipse-outline"}
                size={18}
                color={Number(price) > 0 ? "#076B51" : "#858585"}
              />
              <Text style={[styles.checklistText, Number(price) > 0 && styles.checklistTextDone]}>Price added</Text>
            </View>

            <View style={styles.checklistItem}>
              <Ionicons
                name={Number(weight) > 0 ? "checkmark-circle" : "ellipse-outline"}
                size={18}
                color={Number(weight) > 0 ? "#076B51" : "#858585"}
              />
              <Text style={[styles.checklistText, Number(weight) > 0 && styles.checklistTextDone]}>Weight added</Text>
            </View>

            <View style={styles.checklistItem}>
              <Ionicons
                name={hasDelivery ? "checkmark-circle" : "ellipse-outline"}
                size={18}
                color={hasDelivery ? "#076B51" : "#858585"}
              />
              <Text style={[styles.checklistText, hasDelivery && styles.checklistTextDone]}>Delivery set</Text>
            </View>

          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Photo</Text>
            <TouchableOpacity
              onPress={handlePickImage}
              disabled={uploading || submitting || deleting}
              activeOpacity={0.85}
              style={styles.photoArea}
            >
              {imageUri ? (
                <>
                  <Image source={{ uri: imageUri }} style={styles.uploadedImage} resizeMode="cover" />
                  {uploading ? (
                    <View style={styles.uploadOverlay}>
                      <ActivityIndicator color="#FFFFFF" />
                      <Text style={styles.uploadOverlayText}>Uploading...</Text>
                    </View>
                  ) : (
                    <View style={styles.replaceBadge}>
                      <Ionicons name="refresh" size={12} color="#FFFFFF" />
                      <Text style={styles.replaceBadgeText}>Replace</Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.photoIcon}>
                    <Ionicons name="cloud-upload-outline" size={28} color="#076B51" />
                  </View>
                  <Text style={styles.photoLabel}>Upload Image</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Listing status</Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Published</Text>
              <Switch value={isPublished} onValueChange={setIsPublished} trackColor={{ false: "#D7E4DC", true: "#076B51" }} thumbColor="#FFFFFF" />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Available for sale</Text>
              <Switch value={isAvailable} onValueChange={setIsAvailable} trackColor={{ false: "#D7E4DC", true: "#076B51" }} thumbColor="#FFFFFF" />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Product information</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Foodstuff name</Text>
              <TextInput value={name} onChangeText={setName} placeholder="e.g. Garri (Yellow)" placeholderTextColor="#858585" style={styles.input} />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Category</Text>
              <TouchableOpacity onPress={() => setShowCategories((v) => !v)} style={styles.selectInput}>
                <Text style={styles.selectText}>{category || "Select"}</Text>
                <Ionicons name={showCategories ? "chevron-up" : "chevron-down"} size={16} color="#858585" />
              </TouchableOpacity>
            </View>

            {showCategories && (
              <View style={styles.optionsList}>
                {PRODUCT_CATEGORIES.map((item) => (
                  <TouchableOpacity key={item.id} onPress={() => { setCategory(item.name); setShowCategories(false); }} style={styles.optionItem}>
                    <Text style={styles.optionText}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Store Description</Text>
              <TextInput value={description} onChangeText={setDescription} placeholder="high recommend product" placeholderTextColor="#858585" multiline textAlignVertical="top" style={[styles.input, styles.textArea]} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Pricing and stock</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Price</Text>
              <TextInput value={price} onChangeText={setPrice} placeholder="£10" placeholderTextColor="#858585" keyboardType="decimal-pad" style={styles.input} />
            </View>

            <View style={styles.rowFields}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Weight</Text>
                <TextInput value={weight} onChangeText={setWeight} placeholder="1kg" placeholderTextColor="#858585" keyboardType="numeric" style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Unit</Text>
                <TouchableOpacity onPress={() => setShowUnits((v) => !v)} style={styles.selectInput}>
                  <Text style={styles.selectText}>{unit}</Text>
                  <Ionicons name={showUnits ? "chevron-up" : "chevron-down"} size={16} color="#858585" />
                </TouchableOpacity>
              </View>
            </View>

            {(!weight || Number(weight) <= 0) && (
              <Text style={styles.inputWarning}>Weight is required to calculate delivery cost</Text>
            )}

            {showUnits && (
              <View style={styles.optionsList}>
                {UNITS.map((item) => (
                  <TouchableOpacity key={item} onPress={() => { setUnit(item); setShowUnits(false); }} style={styles.optionItem}>
                    <Text style={styles.optionText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Stock quantity</Text>
              <TextInput value={stock} onChangeText={setStock} placeholder="10" placeholderTextColor="#858585" keyboardType="numeric" style={styles.input} />
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            onPress={handleSave}
            style={[styles.primaryButton, (uploading || submitting || deleting) && { opacity: 0.6 }]}
            disabled={uploading || submitting || deleting}
          >
            <Text style={styles.primaryButtonText}>{submitting ? "Saving..." : "Save Changes"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDelete}
            style={[styles.deleteButton, (uploading || submitting || deleting) && { opacity: 0.6 }]}
            disabled={uploading || submitting || deleting}
          >
            <Text style={styles.deleteButtonText}>{deleting ? "Deleting..." : "Delete this product"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F4F4" },
  headerSafeArea: { backgroundColor: "#076B51" },
  header: {
    backgroundColor: "#076B51",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  headerTitle: { fontSize: 30, fontFamily: "Manrope-Bold", lineHeight: 30, color: "#FFFFFF" },
  headerSubtitle: { fontSize: 16, fontFamily: "Outfit-Light", color: "#FFFFFF", marginTop: 6 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  placeholder: { paddingVertical: 40, alignItems: "center" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 16 },
  photoArea: {
    height: 180,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(7, 107, 81, 0.4)",
    borderStyle: "dashed",
    backgroundColor: "rgba(7, 107, 81, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(7, 107, 81, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  photoLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#076B51" },
  uploadedImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", gap: 6 },
  uploadOverlayText: { fontSize: 12, color: "#FFFFFF", fontFamily: "Outfit-Medium" },
  replaceBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  replaceBadgeText: { fontSize: 11, color: "#FFFFFF", fontFamily: "Outfit-Medium" },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585", marginBottom: 6 },
  input: {
    backgroundColor: "#F4F4F4",
    borderRadius: 10,
    height: 55,
    paddingHorizontal: 15,
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "#282828",
  },
  textArea: { height: 100, paddingVertical: 14 },
  selectInput: {
    backgroundColor: "#F4F4F4",
    borderRadius: 10,
    height: 55,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  optionsList: { gap: 6, marginBottom: 16 },
  optionItem: { backgroundColor: "#F4F4F4", borderRadius: 10, height: 44, paddingHorizontal: 15, justifyContent: "center" },
  optionText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  rowFields: { flexDirection: "row", gap: 10, marginBottom: 16 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  toggleLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#282828" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", marginBottom: 12, textAlign: "center" },
  primaryButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  deleteButton: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FB6363",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FB6363" },
  // ── Checklist banner styling (Figma) ──────────────────────────────────
  checklistCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#E8F5EE",
  },
  checklistTitle: {
    fontSize: 18,
    fontFamily: "Manrope-Bold",
    color: "#282828",
    marginBottom: 4,
  },
  checklistSubtitle: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    marginBottom: 16,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  checklistText: {
    fontSize: 14,
    fontFamily: "Outfit-Medium",
    color: "#858585",
  },
  checklistTextDone: {
    color: "#076B51",
  },
  inputWarning: {
    fontSize: 12,
    fontFamily: "Outfit-Regular",
    color: "#FB6363",
    marginTop: 8,
    marginBottom: 12,
  },
});

import React, { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { FloatingCard, IconAvatar, PrimaryButton } from "./PremiumBlocks";
import { CountrySelectField } from "./CountrySelectField";
import { ApiRequestError } from "../../services/api/client";
import { communityBuyService, type MarketConfig } from "../../services/communityBuyService";
import { useAuthStore } from "../../stores/authStore";
import { countryDisplayName } from "../../utils/countries";
import { useLaunchSettings } from "../../services/launchSettingsService";

/** True when the backend refused because this account has no recognised country. */
export function isCountryRequiredError(err: unknown): boolean {
  return err instanceof ApiRequestError && err.code === "COUNTRY_REQUIRED";
}

/**
 * Community Buy is scoped to the account's own country, and buyers have no
 * other screen where they can set it, so the country is collected in place.
 */
export function CountryRequiredCard({ onSaved }: { onSaved: () => void }) {
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const { ukLaunchMode, launchMarket } = useLaunchSettings();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    communityBuyService
      .listMarketConfigs()
      .then((list) => { if (active) setMarkets(list.filter((m) => m.communityBuyEnabled)); })
      .catch(() => { if (active) setError("Could not load the list of countries. Please try again."); });
    return () => { active = false; };
  }, []);

  const chosen = ukLaunchMode ? launchMarket : selected;

  const handleSave = async () => {
    if (!chosen) return;
    setSaving(true);
    setError("");
    try {
      await updateProfile({ country: countryDisplayName(chosen) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your country.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FloatingCard style={styles.card}>
      <IconAvatar icon="location-outline" tone="success" size={52} />
      <Text style={styles.title}>Where are you based?</Text>
      {ukLaunchMode ? (
        <Text style={styles.body}>Community Buy is open in the {countryDisplayName(launchMarket)}. Continue to see what's available.</Text>
      ) : (
        <>
          <Text style={styles.body}>Community Buy shows campaigns in your own country. Choose it once to continue.</Text>
          <CountrySelectField
            options={markets.map((m) => ({ code: m.countryCode, name: countryDisplayName(m.countryCode) }))}
            value={selected}
            onSelect={setSelected}
            disabled={saving}
            placeholder="Choose your country"
            sheetTitle="Select country"
            accessibilityLabel={selected ? `Country: ${countryDisplayName(selected)}` : "Choose your country"}
          />
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label={ukLaunchMode ? "Continue" : "Save and continue"} disabled={!chosen} loading={saving} onPress={() => void handleSave()} style={styles.button} />
    </FloatingCard>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", gap: 10 },
  title: { fontSize: 18, fontFamily: "Manrope-SemiBold", color: "#101A16", textAlign: "center" },
  body: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#6A7B72", textAlign: "center", lineHeight: 20 },
  error: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#D6552F", textAlign: "center" },
  button: { alignSelf: "stretch" },
});

import React from "react";
import { DisputeCaseScreen } from "../../components/shared/DisputeCaseScreen";

export default function BuyerDisputeDetailScreen() {
  return <DisputeCaseScreen fallbackRoute="/(buyer)/orders" reportIssueRoute="/(buyer)/report-issue" />;
}

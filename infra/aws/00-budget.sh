#!/usr/bin/env bash
# Creates a monthly cost budget that emails you before credits disappear.
# Run this FIRST - it is the cheapest insurance in the whole plan.
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account: $ACCOUNT_ID   Region: $AWS_REGION"

cat > /tmp/budget.json <<JSON
{
  "BudgetName": "${PROJECT}-monthly",
  "BudgetLimit": { "Amount": "${BUDGET_LIMIT}", "Unit": "USD" },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
JSON

# Warn at 50% and 80% of forecast, and at 100% of actual spend.
cat > /tmp/notifications.json <<JSON
[
  { "Notification": { "NotificationType": "FORECASTED", "ComparisonOperator": "GREATER_THAN", "Threshold": 50, "ThresholdType": "PERCENTAGE" },
    "Subscribers": [ { "SubscriptionType": "EMAIL", "Address": "${BUDGET_EMAIL}" } ] },
  { "Notification": { "NotificationType": "FORECASTED", "ComparisonOperator": "GREATER_THAN", "Threshold": 80, "ThresholdType": "PERCENTAGE" },
    "Subscribers": [ { "SubscriptionType": "EMAIL", "Address": "${BUDGET_EMAIL}" } ] },
  { "Notification": { "NotificationType": "ACTUAL", "ComparisonOperator": "GREATER_THAN", "Threshold": 100, "ThresholdType": "PERCENTAGE" },
    "Subscribers": [ { "SubscriptionType": "EMAIL", "Address": "${BUDGET_EMAIL}" } ] }
]
JSON

if aws budgets describe-budget --account-id "$ACCOUNT_ID" \
     --budget-name "${PROJECT}-monthly" >/dev/null 2>&1; then
  echo "Budget already exists - leaving it alone."
else
  aws budgets create-budget --account-id "$ACCOUNT_ID" \
    --budget file:///tmp/budget.json \
    --notifications-with-subscribers file:///tmp/notifications.json
  echo "Budget created: alerts at 50%/80% forecast and 100% actual of \$${BUDGET_LIMIT}/month."
fi
rm -f /tmp/budget.json /tmp/notifications.json
echo
echo "Confirm the subscription in the email AWS sends, or alerts will not arrive."

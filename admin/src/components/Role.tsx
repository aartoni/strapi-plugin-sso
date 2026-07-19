import { Box, Button, Field, Textarea } from "@strapi/design-system";
import React from "react";
import { useIntl } from "react-intl";
import { getTranslation } from "../utils/translations";

type Props = {
  expression: string;
  onChange: (value: string) => void;
  onSave: () => void;
};

export function Role({ expression, onChange, onSave }: Props) {
  const { formatMessage } = useIntl();

  return (
    <Box>
      <Field.Root
        hint={formatMessage({
          id: getTranslation("role.expression.hint"),
          defaultMessage:
            "A JMESPath expression evaluated against the OIDC claims. Must return a Strapi role name.",
        })}
      >
        <Field.Label>
          {formatMessage({
            id: getTranslation("role.expression.label"),
            defaultMessage: "Role mapping",
          })}
        </Field.Label>
        <Textarea
          value={expression}
          onChange={(e) => onChange(e.target.value)}
          placeholder="contains(groups[*], 'admins') && 'Super Admin' || 'Editor'"
        />
        <Field.Hint />
      </Field.Root>
      <Box paddingTop={4}>
        <Button onClick={onSave}>
          {formatMessage({
            id: getTranslation("page.save"),
            defaultMessage: "Save",
          })}
        </Button>
      </Box>
    </Box>
  );
}

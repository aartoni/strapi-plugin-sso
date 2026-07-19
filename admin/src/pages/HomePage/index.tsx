import React, { memo, useEffect, useState } from "react";
import { Box } from "@strapi/design-system";
import { Page, Layouts } from "@strapi/strapi/admin";
import { useIntl } from "react-intl";
import { useFetchClient } from "@strapi/strapi/admin";
import { Role } from "../../components/Role";
import {
  ErrorAlertMessage,
  SuccessAlertMessage,
} from "../../components/AlertMessage";
import { getTranslation } from "../../utils/translations";

type SsoRolesResponse = { expression: string } | null;

const HomePage = () => {
  const { formatMessage } = useIntl();
  const [expression, setExpression] = useState("");
  const [showSuccess, setSuccess] = useState(false);
  const [showError, setError] = useState(false);
  const { get, put } = useFetchClient();

  useEffect(() => {
    get<SsoRolesResponse>("/oidc/sso-roles").then((response) => {
      setExpression(response.data?.expression ?? "");
    });
  }, []);

  const onSave = async () => {
    try {
      await put("/oidc/sso-roles", { expression });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      setError(true);
      setTimeout(() => setError(false), 3000);
    }
  };

  return (
    <Page.Protect
      permissions={[{ action: "plugin::oidc.read", subject: null }]}
    >
      <Layouts.Header
        title="Single Sign On"
        subtitle={formatMessage({
          id: getTranslation("page.title"),
          defaultMessage:
            "Assign Strapi roles to users based on their OIDC claims",
        })}
      />
      {showSuccess && <SuccessAlertMessage onClose={() => setSuccess(false)} />}
      {showError && <ErrorAlertMessage onClose={() => setError(false)} />}
      <Box padding={10}>
        <Role
          expression={expression}
          onChange={setExpression}
          onSave={onSave}
        />
      </Box>
    </Page.Protect>
  );
};

export default memo(HomePage);

import { Alert } from "@strapi/design-system";
import React, { ComponentProps } from "react";
import { useIntl } from "react-intl";
import styled from "styled-components";
import { getTranslation } from "../utils/translations";

const AlertMessage = styled.div`
  margin-left: -250px;
  position: fixed;
  left: 50%;
  top: 2.875rem;
  z-index: 10;
  width: 31.25rem;
`;

type Props = Pick<ComponentProps<typeof Alert>, "onClose">;

export function SuccessAlertMessage({ onClose }: Props) {
  const { formatMessage } = useIntl();
  return (
    <AlertMessage>
      <Alert
        title="Success"
        variant={"success"}
        closeLabel={""}
        onClose={onClose}
      >
        {formatMessage({
          id: getTranslation("page.save.success"),
          defaultMessage: "Settings updated",
        })}
      </Alert>
    </AlertMessage>
  );
}

export function ErrorAlertMessage({ onClose }: Props) {
  const { formatMessage } = useIntl();
  return (
    <AlertMessage>
      <Alert title="Error" variant={"danger"} closeLabel={""} onClose={onClose}>
        {formatMessage({
          id: getTranslation("page.save.error"),
          defaultMessage: "Update failed",
        })}
      </Alert>
    </AlertMessage>
  );
}

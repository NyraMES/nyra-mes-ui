import { GeneratedIdsDialog } from "../../../workflow/ui";

/** OEM-style popup after AC save — shows sequence-generated business IDs. */
function AcCreatedIdsDialog({
  open,
  title = "Record created",
  subtitle,
  items = [],
  continueLabel = "Continue",
  onContinue,
  onClose
}) {
  return (
    <GeneratedIdsDialog
      open={open}
      title={title}
      subtitle={subtitle}
      items={items}
      continueLabel={continueLabel}
      onContinue={onContinue}
      onClose={onClose}
    />
  );
}

export default AcCreatedIdsDialog;

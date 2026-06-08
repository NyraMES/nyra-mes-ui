import { demoWatermark, isDemoMode } from "../config/demoMode";
import { useAppContext } from "../context/AppContext";

/**
 * Fixed banner + subtle viewport watermark for prospect / video demos.
 */
export default function DemoWatermark() {
  const { context } = useAppContext();
  if (!isDemoMode(context)) return null;

  const text = demoWatermark(context);

  return (
    <>
      <div className="nyra-demo-banner" role="status" aria-live="polite">
        <span className="nyra-demo-banner__icon" aria-hidden>
          ⬤
        </span>
        <span>{text}</span>
        <span className="nyra-demo-banner__note">
          Read-only · Do not use for production decisions
        </span>
      </div>
      <div className="nyra-demo-viewport-mark" aria-hidden>
        {text}
      </div>
    </>
  );
}

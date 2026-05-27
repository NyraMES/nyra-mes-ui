import { useState } from "react";

import "../styles/Form.css";


function Tabs({ tabs, initialIndex = 0 }) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  if (!tabs || tabs.length === 0) {
    return null;
  }

  const safeIndex = Math.min(activeIndex, tabs.length - 1);
  const activeTab = tabs[safeIndex];

  return (
    <div className="tabs-container">
      <div className="tabs-header">
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            className={
              "tab-button" +
              (index === safeIndex ? " active" : "")
            }
            onClick={() => setActiveIndex(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tabs-content">
        {activeTab.content}
      </div>
    </div>
  );
}

export default Tabs;

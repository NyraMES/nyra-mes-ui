import "../styles/Form.css";

function FormCard({ title, children }) {
  return (
    <div className="form-section">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export default FormCard;
import "../styles/Form.css";

function FormField({ label, children }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export default FormField;
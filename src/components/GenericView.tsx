interface GenericViewProps {
  title: string;
}

export default function GenericView({ title }: GenericViewProps) {
  return (
    <div className="workspace">
      <div className="center-content">
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <h2>{title}</h2>
          <p>This module is under construction. Please use the Atlas & Timeline module.</p>
        </div>
      </div>
    </div>
  );
}

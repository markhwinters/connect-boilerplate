export default function GlassCard({ children, className = '', hover = false, ...props }) {
  return (
    <div
      className={`glass rounded-2xl p-6 transition-all duration-300 ${hover ? 'glass-hover cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

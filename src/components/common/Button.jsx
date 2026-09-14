import './Button.css';

/**
 * variant: 'primary' | 'outline'
 * size: 'md' | 'sm'
 * as: any renderable component — defaults to 'button'. Pass Link from
 *     react-router-dom to render a styled anchor that behaves like a button.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  full = false,
  as: Component = 'button',
  className = '',
  type,
  ...rest
}) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : '',
    full ? 'btn-full' : '',
    className,
  ].filter(Boolean).join(' ');

  // Only pass 'type' when rendering a native button/input so we don't get
  // unknown-DOM-attribute warnings when Component is a React Router Link.
  const typeAttr = Component === 'button' || Component === 'input'
    ? { type: type ?? 'button' }
    : {};

  return (
    <Component className={classes} {...typeAttr} {...rest}>
      {children}
    </Component>
  );
}

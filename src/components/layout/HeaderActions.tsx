
import React from 'react';
import { Button, ButtonProps } from '../shared';
import './HeaderActions.css';

/**
 * Container for the entire right-side actions area
 */
export function HeaderToolbar({ children }: { children: React.ReactNode }) {
    return <div className="header-toolbar">{children}</div>;
}

/**
 * A grouped set of related actions (e.g. View Controls, History Controls)
 * Renders with a subtle background and border to visually group icons.
 */
export function HeaderActionGroup({ children }: { children: React.ReactNode }) {
    return <div className="header-action-group">{children}</div>;
}

/**
 * A standard divider between action groups
 */
export function HeaderDivider() {
    return <div className="header-actions-divider" />;
}

/**
 * Standard Header Button
 * Defaults to the "ghost" minimalist square style for icons.
 */
interface HeaderButtonProps extends Omit<ButtonProps, 'variant' | 'children'> {
    children?: React.ReactNode;
    icon?: React.ReactNode;
    active?: boolean;
    badge?: number | boolean;
    variant?: 'ghost' | 'primary' | 'secondary' | 'danger';
}

export function HeaderButton({
    children,
    icon,
    active,
    badge,
    className = '',
    variant = 'ghost',
    ...props
}: HeaderButtonProps) {
    return (
        <Button
            variant={variant}
            className={`header-icon-btn ${active ? 'active' : ''} ${className}`}
            {...props}
        >
            {icon}
            {children}
            {badge === true && <span className="header-btn-badge-dot" />}
            {typeof badge === 'number' && badge > 0 && (
                <span className="header-btn-badge-count">{badge}</span>
            )}
        </Button>
    );
}

import { alpha } from '@mui/material/styles';
// * Styles cho ChartSettingsPanel

export const panelStyles = {
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9,
        cursor: 'default',
        bgcolor: 'transparent'
    },

    paper: (theme) => ({
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 320, // Chiều rộng cố định
        zIndex: 10,
        borderRadius: '0 16px 16px 0', // Bo góc khớp với container (nếu container bo) hoặc tùy chỉnh
        borderLeft: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: alpha(theme.palette.background.paper, 0.95), // Nền tối, đậm hơn glass thường để dễ đọc chữ
        backdropFilter: 'blur(20px)',
    }),

    header: (theme) => ({
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${theme.palette.divider}`
    }),

    title: {
        fontWeight: 700,
        fontSize: '1rem',
        textTransform: 'uppercase',
        letterSpacing: 1
    },

    content: (theme) => ({
        p: 2,
        flex: 1,
        overflowY: 'auto',
        '&::-webkit-scrollbar': { width: '4px' },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': { background: theme.palette.divider, borderRadius: 2 }
    })
};

// Styles cho ChartSettingItem
export const sectionStyles = {
    container: {
        mb: 3
    },

    title: (theme) => ({
        color: theme.palette.text.secondary,
        fontWeight: 700,
        textTransform: 'uppercase',
        mb: 1.5,
        display: 'block'
    }),
    
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: 1
    },

    divider: {
        mt: 3,
        opacity: 0.5
    }
};

// Styles cho ChartSettingSection
export const itemStyles = {
    container: (theme) => ({
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        p: 1,
        borderRadius: 1,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        '&:hover': {
            bgcolor: alpha(theme.palette.common.white, 0.05)
        }
    }),

    labelWrapper: {
        display: 'flex',
        alignItems: 'center',
        gap: 1.5
    },

    colorDot: (color, checked) => ({
        width: 10, 
        height: 10, 
        borderRadius: '50%', 
        bgcolor: color,
        boxShadow: checked ? `0 0 8px ${color}` : 'none',
        transition: 'box-shadow 0.3s'
    }),

    labelText: (theme, checked) => ({
        color: checked ? theme.palette.text.primary : theme.palette.text.secondary,
        fontWeight: checked ? 500 : 400
    }),

    control: {
        pointerEvents: 'none'
    },

    checkbox: {
        p: 0.5,
        pointerEvents: 'none'
    }
};
    
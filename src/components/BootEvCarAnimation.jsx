import { Box, useTheme } from '@mui/material'

/**
 * 부트 로딩: 사용자 제공 정면 차 SVG + 방지턱/서스펜션 루프 (CSS transform, prefers-reduced-motion)
 */
export function BootEvCarAnimation({ reduceMotion = false }) {
  const theme = useTheme()
  const bodyShadow =
    theme.palette.mode === 'dark'
      ? 'drop-shadow(0 4px 14px rgba(37, 99, 235, 0.35))'
      : 'drop-shadow(0 4px 12px rgba(37, 99, 235, 0.28))'
  /** 라이트: 제공 SVG와 동일 #111111 / 다크: 대비용 밝은 톤 */
  const carFill = theme.palette.mode === 'dark' ? theme.palette.grey[100] : '#111111'

  return (
    <Box
      className={reduceMotion ? 'ev-boot-car ev-boot-car--static' : 'ev-boot-car'}
      aria-hidden="true"
      sx={{
        width: '100%',
        maxWidth: 176,
        height: 78,
        position: 'relative',
        mx: 'auto',
        overflow: 'visible',
      }}
    >
      <Box
        className="ev-boot-car__ground"
        sx={{
          position: 'absolute',
          left: '8%',
          right: '8%',
          bottom: 6,
          height: 2,
          borderRadius: 999,
          bgcolor: 'action.disabledBackground',
          opacity: 0.45,
        }}
      />
      <Box
        className="ev-boot-car__body"
        sx={{
          position: 'absolute',
          left: '50%',
          bottom: 12,
          width: 58,
          height: 58,
          marginLeft: '-29px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transformOrigin: '50% 100%',
          filter: bodyShadow,
          color: carFill,
        }}
      >
        <Box
          component="svg"
          xmlns="http://www.w3.org/2000/svg"
          width={58}
          height={58}
          viewBox="0 0 72 72"
          fill="none"
          sx={{ display: 'block', width: 58, height: 58 }}
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M36 11.25C42.497 11.25 47.8692 11.8131 51.1016 12.2578C53.9677 12.6522 56.264 14.6023 57.2959 17.1816L61.5225 27.75H66C67.2426 27.75 68.25 28.7574 68.25 30C68.25 31.2426 67.2426 32.25 66 32.25H65.4326L65.834 32.6514C67.3812 34.1986 68.25 36.2974 68.25 38.4854V62.25H52.6094L49.6094 56.25H22.3906L19.3906 62.25H3.75V38.4854C3.75 36.2974 4.6189 34.1986 6.16602 32.6514L6.56738 32.25H6C4.75736 32.25 3.75 31.2426 3.75 30C3.75 28.7574 4.75736 27.75 6 27.75H10.4766L14.7041 17.1816C15.736 14.6023 18.0324 12.6522 20.8984 12.2578C24.1309 11.8131 29.5029 11.25 36 11.25ZM8.25 57.75H16.6094L19.6094 51.75H52.3906L55.3906 57.75H63.75V41.25H54V46H18V41.25H8.25V57.75ZM36 30.75C31.3688 30.75 25.4408 31.119 20.6328 31.4932C18.2369 31.6796 16.1334 31.866 14.6299 32.0059C13.9689 32.0673 13.424 32.1197 13.0215 32.1592L9.34863 35.834C9.07679 36.1059 8.85154 36.4154 8.67676 36.75H18V41H54V36.75H63.3232C63.1485 36.4154 62.9232 36.1059 62.6514 35.834L58.9775 32.1592C58.5751 32.1198 58.0306 32.0673 57.3701 32.0059C55.8666 31.866 53.7631 31.6796 51.3672 31.4932C46.5592 31.119 40.6312 30.75 36 30.75ZM36 15.75C29.7543 15.75 24.5927 16.2919 21.5117 16.7158C20.3606 16.8742 19.3561 17.6679 18.8818 18.8535L15.457 27.4131C16.8112 27.2914 18.4634 27.1484 20.2832 27.0068C25.1138 26.631 31.1858 26.25 36 26.25C40.8142 26.25 46.8862 26.631 51.7168 27.0068C53.5361 27.1484 55.188 27.2915 56.542 27.4131L53.1182 18.8535C52.644 17.668 51.6396 16.8742 50.4883 16.7158C47.4074 16.2919 42.2456 15.75 36 15.75Z"
            fill="currentColor"
          />
        </Box>
      </Box>
    </Box>
  )
}

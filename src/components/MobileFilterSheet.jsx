import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Drawer,
  List,
  ListItemButton,
  TextField,
  Typography,
} from '@mui/material'
import { appMobileType, colors, radius, motion } from '../theme/dashboardTheme.js'

/**
 * 모바일 단일 필터 시트: Drawer + 스크롤 본문(칩·검색·리스트). 중첩 Modal 없음.
 */
export function MobileFilterSheet({
  open,
  onClose,
  speedOptions = [],
  filterSpeed,
  onFilterSpeedChange,
  filterBusiNm,
  onFilterBusiNmChange,
  busiOptions = [],
  filterCtprvnCd,
  onFilterCtprvnCdChange,
  ctprvnOptions = [],
  filterSggCd,
  onFilterSggCdChange,
  sggOptions = [],
}) {
  const [busiSearch, setBusiSearch] = useState('')
  const ctprvnSelected = !!filterCtprvnCd
  const titleRef = useRef(null)

  useEffect(() => {
    if (open) setBusiSearch('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => titleRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])
  const filteredBusi = useMemo(() => {
    const q = busiSearch.trim().toLowerCase()
    if (!q) return busiOptions
    return busiOptions.filter((o) => {
      const t = (o.label ?? o.value ?? '').toString().toLowerCase()
      return t.includes(q)
    })
  }, [busiOptions, busiSearch])

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      sx={{ zIndex: 1200 }}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: 'rgba(15,23,42,0.44)',
            backdropFilter: 'brightness(0.94)',
            WebkitBackdropFilter: 'brightness(0.94)',
          },
        },
        transition: { timeout: { enter: motion.duration.enter, exit: motion.duration.exit } },
      }}
      PaperProps={{
        component: 'div',
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': 'ev-filter-sheet-title',
        sx: {
          maxHeight: 'min(88dvh, 100%)',
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          bgcolor: colors.white,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          pt: 1,
          pb: 1,
          px: 2,
          borderBottom: `1px solid ${colors.gray[200]}`,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 4,
            borderRadius: 2,
            bgcolor: colors.gray[300],
            mx: 'auto',
            mb: 1,
          }}
          aria-hidden
        />
        <Typography
          id="ev-filter-sheet-title"
          ref={titleRef}
          tabIndex={-1}
          variant="subtitle1"
          component="h2"
          sx={{ color: colors.gray[900], outline: 'none', ...appMobileType.filterSheetTitle }}
        >
          필터
        </Typography>
        <Typography variant="body2" sx={{ color: colors.gray[600], display: 'block', mt: 0.35, ...appMobileType.filterSheetHint }}>
          조건을 바꾼 뒤 닫으면 목록·지도에 반영됩니다.
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          px: 2,
          pt: 1.5,
          pb: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <Typography variant="subtitle2" component="h3" sx={{ color: colors.gray[800], display: 'block', mb: 0.85, ...appMobileType.filterSectionLabel }}>
          충전 타입
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.625, mb: 2 }}>
          {speedOptions.map((opt) => {
            const v = opt.value
            const selected = filterSpeed === v
            return (
              <Chip
                key={v || 'all'}
                label={opt.label}
                size="small"
                onClick={() => onFilterSpeedChange(v)}
                sx={{
                  fontSize: appMobileType.filterChip.fontSize,
                  height: appMobileType.filterChip.height,
                  fontWeight: selected ? 700 : 600,
                  bgcolor: selected ? colors.blue.primary : colors.gray[50],
                  color: selected ? colors.white : colors.gray[700],
                  border: `1px solid ${selected ? colors.blue.primary : colors.gray[200]}`,
                  transition: `background-color ${motion.duration.enter}ms ${motion.easing.standard}`,
                  '&:active': { transform: 'scale(0.97)' },
                }}
              />
            )
          })}
        </Box>

        <Typography variant="subtitle2" component="h3" sx={{ color: colors.gray[800], display: 'block', mb: 0.6, ...appMobileType.filterSectionLabel }}>
          운영기관
        </Typography>
        <TextField
          size="small"
          fullWidth
          placeholder="검색…"
          value={busiSearch}
          onChange={(e) => setBusiSearch(e.target.value)}
          sx={{
            mb: 0.75,
            '& .MuiOutlinedInput-root': { borderRadius: `${radius.sm}px`, fontSize: appMobileType.searchField.fontSize },
          }}
        />
        <List dense disablePadding sx={{ mb: 2, maxHeight: 168, overflow: 'auto', border: `1px solid ${colors.gray[200]}`, borderRadius: `${radius.sm}px` }}>
          <ListItemButton
            selected={!filterBusiNm}
            onClick={() => onFilterBusiNmChange('')}
            sx={{ fontSize: appMobileType.filterListItem.fontSize, py: 0.875 }}
          >
            전체
          </ListItemButton>
          {filteredBusi.map((opt) => {
            const val = opt.value ?? opt
            const sel = filterBusiNm === val
            return (
              <ListItemButton
                key={val}
                selected={sel}
                onClick={() => onFilterBusiNmChange(val)}
                sx={{
                  fontSize: appMobileType.filterListItem.fontSize,
                  py: 0.875,
                  bgcolor: sel ? colors.blue.muted : undefined,
                }}
              >
                {opt.label ?? opt.value ?? val}
              </ListItemButton>
            )
          })}
        </List>

        <Typography variant="subtitle2" component="h3" sx={{ color: colors.gray[800], display: 'block', mb: 0.6, ...appMobileType.filterSectionLabel }}>
          시도 코드
        </Typography>
        <List dense disablePadding sx={{ mb: 2, maxHeight: 140, overflow: 'auto', border: `1px solid ${colors.gray[200]}`, borderRadius: `${radius.sm}px` }}>
          <ListItemButton
            selected={!filterCtprvnCd}
            onClick={() => onFilterCtprvnCdChange('')}
            sx={{ fontSize: appMobileType.filterListItem.fontSize, py: 0.875 }}
          >
            미선택
          </ListItemButton>
          {ctprvnOptions.map((opt) => {
            const val = opt.value ?? opt
            const sel = filterCtprvnCd === val
            return (
              <ListItemButton
                key={val}
                selected={sel}
                onClick={() => onFilterCtprvnCdChange(val)}
                sx={{ fontSize: appMobileType.filterListItem.fontSize, py: 0.875, bgcolor: sel ? colors.blue.muted : undefined }}
              >
                {opt.label ?? opt.value ?? val}
              </ListItemButton>
            )
          })}
        </List>

        <Typography variant="subtitle2" component="h3" sx={{ color: colors.gray[800], display: 'block', mb: 0.6, ...appMobileType.filterSectionLabel }}>
          시군구 코드
        </Typography>
        <List
          dense
          disablePadding
          sx={{
            mb: 2,
            maxHeight: 140,
            overflow: 'auto',
            border: `1px solid ${colors.gray[200]}`,
            borderRadius: `${radius.sm}px`,
            opacity: ctprvnSelected ? 1 : 0.45,
            pointerEvents: ctprvnSelected ? 'auto' : 'none',
          }}
        >
          <ListItemButton
            selected={!filterSggCd}
            disabled={!ctprvnSelected}
            onClick={() => onFilterSggCdChange('')}
            sx={{ fontSize: appMobileType.filterListItem.fontSize, py: 0.875 }}
          >
            미선택
          </ListItemButton>
          {sggOptions.map((opt) => {
            const val = opt.value ?? opt
            const sel = filterSggCd === val
            return (
              <ListItemButton
                key={val}
                selected={sel}
                disabled={!ctprvnSelected}
                onClick={() => onFilterSggCdChange(val)}
                sx={{ fontSize: appMobileType.filterListItem.fontSize, py: 0.875, bgcolor: sel ? colors.blue.muted : undefined }}
              >
                {opt.label ?? opt.value ?? val}
              </ListItemButton>
            )
          })}
        </List>

        <Button
          fullWidth
          variant="contained"
          onClick={onClose}
          sx={{
            py: 1.1,
            borderRadius: `${radius.sm}px`,
            bgcolor: colors.gray[800],
            fontWeight: 700,
            fontSize: appMobileType.body.fontSize.xs,
            textTransform: 'none',
            boxShadow: 'none',
            transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}`,
            '&:hover': { bgcolor: colors.gray[900], boxShadow: 'none' },
            '&:active': { transform: 'scale(0.98)' },
          }}
        >
          완료
        </Button>
      </Box>
    </Drawer>
  )
}

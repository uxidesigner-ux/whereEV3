import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  TextField,
  Typography,
} from '@mui/material'
import Close from '@mui/icons-material/Close'
import { appMobileType, radius, motion } from '../theme/dashboardTheme.js'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'
import { ThemeAppearanceControl } from './ThemeAppearanceControl.jsx'

const defaultDraft = () => ({
  sort: /** @type {'distance' | 'name'} */ ('distance'),
  speed: '',
  availOnly: false,
  busiNm: '',
  ctprvnCd: '',
  sggCd: '',
})

/**
 * 모바일 앱형 필터 바텀시트 — draft 편집 후「적용하기」로 반영. 닫기(X/백드롭)는 미적용 종료.
 */
export function MobileFilterSheet({
  open,
  onClose,
  onApply,
  listSort,
  listAvailOnly,
  hasAvailInGroupedScope,
  filterSpeed,
  filterBusiNm,
  filterCtprvnCd,
  filterSggCd,
  speedOptions = [],
  busiOptions = [],
  ctprvnOptions = [],
  /** 시도별 시군구 — draft.ctprvnCd 기준으로 목록 표시(적용 전 미리보기) */
  sggCdsByCtprvn = {},
}) {
  const { colors, tokens } = useEvTheme()
  const [draft, setDraft] = useState(defaultDraft)
  const [busiSearch, setBusiSearch] = useState('')
  const titleRef = useRef(null)
  const ctprvnSelected = !!draft.ctprvnCd
  const sggOptions = useMemo(
    () => sggCdsByCtprvn[draft.ctprvnCd] ?? [],
    [sggCdsByCtprvn, draft.ctprvnCd]
  )

  useEffect(() => {
    if (!open) return
    setDraft({
      sort: listSort,
      speed: filterSpeed,
      availOnly: listAvailOnly,
      busiNm: filterBusiNm,
      ctprvnCd: filterCtprvnCd,
      sggCd: filterSggCd,
    })
    setBusiSearch('')
  }, [open, listSort, listAvailOnly, filterSpeed, filterBusiNm, filterCtprvnCd, filterSggCd])

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

  const selectedCtprvnLabel = useMemo(() => {
    if (!draft.ctprvnCd) return ''
    const o = ctprvnOptions.find((x) => String(x.value ?? x) === String(draft.ctprvnCd))
    return (o?.label ?? o?.value ?? '').toString()
  }, [ctprvnOptions, draft.ctprvnCd])

  const selectedSggLabel = useMemo(() => {
    if (!draft.sggCd) return ''
    const o = sggOptions.find((x) => String(x.value ?? x) === String(draft.sggCd))
    return (o?.label ?? o?.value ?? '').toString()
  }, [sggOptions, draft.sggCd])

  const resetDraft = () => setDraft(defaultDraft())

  const chipBase = (selected) => ({
    height: 34,
    fontSize: '0.8125rem',
    fontWeight: selected ? 700 : 600,
    borderRadius: `${radius.md}px`,
    transition: `background-color ${motion.duration.enter}ms ${motion.easing.standard}, border-color ${motion.duration.enter}ms ${motion.easing.standard}`,
    '& .MuiChip-label': { px: 1.25 },
  })

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      sx={{ zIndex: 1200 }}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: tokens.overlay.scrim,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          },
        },
        transition: { timeout: { enter: motion.duration.sheet, exit: motion.duration.exit } },
      }}
      PaperProps={{
        component: 'div',
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': 'ev-filter-sheet-title',
        sx: {
          maxHeight: 'min(88dvh, 100%)',
          borderTopLeftRadius: radius.sheetApp,
          borderTopRightRadius: radius.sheetApp,
          bgcolor: tokens.bg.paper,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: tokens.shadow.sheet,
        },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          pt: 1.25,
          pb: 1.5,
          px: 2.5,
          borderBottom: `1px solid ${colors.gray[200]}`,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 4,
            borderRadius: 2,
            bgcolor: colors.gray[300],
            mx: 'auto',
            mb: 1.25,
          }}
          aria-hidden
        />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography
            id="ev-filter-sheet-title"
            ref={titleRef}
            tabIndex={-1}
            variant="h6"
            component="h2"
            sx={{ color: colors.gray[900], outline: 'none', fontWeight: 700, fontSize: '1.125rem' }}
          >
            필터
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <Button
              type="button"
              variant="text"
              size="small"
              onClick={resetDraft}
              sx={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: colors.gray[600],
                textTransform: 'none',
                minWidth: 0,
              }}
            >
              초기화
            </Button>
            <IconButton onClick={onClose} aria-label="필터 닫기" size="small" sx={{ color: colors.gray[600] }}>
              <Close />
            </IconButton>
          </Box>
        </Box>
        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: colors.gray[500], fontSize: '0.75rem' }}>
          변경 후 하단「적용하기」를 누르면 목록·지도에 반영됩니다.
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          px: 2.5,
          pt: 2,
          pb: 2,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.gray[800], mb: 1, fontSize: '0.8125rem' }}>
          정렬
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.75 }}>
          {[
            { v: 'distance', label: '가까운 순' },
            { v: 'name', label: '이름순' },
          ].map(({ v, label }) => {
            const selected = draft.sort === v
            return (
              <Chip
                key={v}
                label={label}
                onClick={() => setDraft((d) => ({ ...d, sort: v }))}
                sx={{
                  ...chipBase(selected),
                  bgcolor: selected ? colors.blue.primary : colors.gray[50],
                  color: selected ? tokens.text.onPrimary : colors.gray[700],
                  border: `1px solid ${selected ? colors.blue.primary : colors.gray[200]}`,
                }}
              />
            )
          })}
        </Box>

        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.gray[800], mb: 1, fontSize: '0.8125rem' }}>
          충전 속도
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.75 }}>
          {speedOptions.map((opt) => {
            const v = opt.value
            const selected = draft.speed === v
            return (
              <Chip
                key={v || 'all'}
                label={opt.label}
                onClick={() => setDraft((d) => ({ ...d, speed: v }))}
                sx={{
                  ...chipBase(selected),
                  bgcolor: selected ? colors.blue.primary : colors.gray[50],
                  color: selected ? tokens.text.onPrimary : colors.gray[700],
                  border: `1px solid ${selected ? colors.blue.primary : colors.gray[200]}`,
                }}
              />
            )
          })}
        </Box>

        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.gray[800], mb: 1, fontSize: '0.8125rem' }}>
          상태
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.75 }}>
          <Chip
            label="전체"
            onClick={() => setDraft((d) => ({ ...d, availOnly: false }))}
            disabled={false}
            sx={{
              ...chipBase(!draft.availOnly),
              bgcolor: !draft.availOnly ? colors.blue.primary : colors.gray[50],
              color: !draft.availOnly ? tokens.text.onPrimary : colors.gray[700],
              border: `1px solid ${!draft.availOnly ? colors.blue.primary : colors.gray[200]}`,
            }}
          />
          <Chip
            label="사용 가능만"
            onClick={() => hasAvailInGroupedScope && setDraft((d) => ({ ...d, availOnly: true }))}
            disabled={!hasAvailInGroupedScope}
            sx={{
              ...chipBase(draft.availOnly),
              bgcolor: draft.availOnly ? colors.blue.primary : colors.gray[50],
              color: draft.availOnly ? tokens.text.onPrimary : colors.gray[700],
              border: `1px solid ${draft.availOnly ? colors.blue.primary : colors.gray[200]}`,
              ...( !hasAvailInGroupedScope ? { opacity: 0.55 } : {}),
            }}
          />
        </Box>

        <Box sx={{ height: 1, bgcolor: colors.gray[200], my: 0.5, mb: 2 }} />

        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.gray[800], mb: 1, fontSize: '0.8125rem' }}>
          운영기관
        </Typography>
        <TextField
          size="small"
          fullWidth
          placeholder="검색…"
          value={busiSearch}
          onChange={(e) => setBusiSearch(e.target.value)}
          sx={{
            mb: 1,
            '& .MuiOutlinedInput-root': { borderRadius: `${radius.md}px`, fontSize: appMobileType.searchField.fontSize },
          }}
        />
        <List dense disablePadding sx={{ mb: 2.5, maxHeight: 160, overflow: 'auto', border: `1px solid ${colors.gray[200]}`, borderRadius: `${radius.md}px` }}>
          <ListItemButton
            selected={!draft.busiNm}
            onClick={() => setDraft((d) => ({ ...d, busiNm: '' }))}
            sx={{ fontSize: appMobileType.filterListItem.fontSize, py: 1 }}
          >
            전체
          </ListItemButton>
          {filteredBusi.map((opt) => {
            const val = opt.value ?? opt
            const sel = draft.busiNm === val
            return (
              <ListItemButton
                key={val}
                selected={sel}
                onClick={() => setDraft((d) => ({ ...d, busiNm: val }))}
                sx={{
                  fontSize: appMobileType.filterListItem.fontSize,
                  py: 1,
                  bgcolor: sel ? colors.blue.muted : undefined,
                }}
              >
                {opt.label ?? opt.value ?? val}
              </ListItemButton>
            )
          })}
        </List>

        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.gray[800], mb: 0.5, fontSize: '0.8125rem' }}>
          지역
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: colors.gray[500], fontSize: '0.75rem', mb: 0.75, lineHeight: 1.45 }}>
          시·도 단위로 먼저 좁힙니다.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 1 }}>
          {draft.ctprvnCd && selectedCtprvnLabel ? (
            <Chip
              label={selectedCtprvnLabel}
              size="small"
              variant="outlined"
              sx={{
                height: 32,
                borderRadius: 9999,
                fontWeight: 600,
                fontSize: '0.8125rem',
                borderColor: colors.gray[200],
                bgcolor: tokens.bg.paper,
                color: colors.gray[800],
                '& .MuiChip-label': { px: 1.5 },
              }}
            />
          ) : (
            <Typography variant="caption" component="span" sx={{ color: colors.gray[500], fontSize: '0.8125rem' }}>
              선택 안 함
            </Typography>
          )}
        </Box>
        <List dense disablePadding sx={{ mb: 2.5, maxHeight: 132, overflow: 'auto', border: `1px solid ${colors.gray[200]}`, borderRadius: `${radius.md}px` }}>
          <ListItemButton
            selected={!draft.ctprvnCd}
            onClick={() => setDraft((d) => ({ ...d, ctprvnCd: '', sggCd: '' }))}
            sx={{ fontSize: appMobileType.filterListItem.fontSize, py: 1 }}
          >
            미선택
          </ListItemButton>
          {ctprvnOptions.map((opt) => {
            const val = opt.value ?? opt
            const sel = draft.ctprvnCd === val
            return (
              <ListItemButton
                key={val}
                selected={sel}
                onClick={() => setDraft((d) => ({ ...d, ctprvnCd: val, sggCd: '' }))}
                sx={{ fontSize: appMobileType.filterListItem.fontSize, py: 1, bgcolor: sel ? colors.blue.muted : undefined }}
              >
                {opt.label ?? opt.value ?? val}
              </ListItemButton>
            )
          })}
        </List>

        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.gray[800], mb: 0.5, fontSize: '0.8125rem' }}>
          상세 지역
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: colors.gray[500],
            fontSize: '0.75rem',
            mb: 0.75,
            lineHeight: 1.45,
            opacity: ctprvnSelected ? 1 : 0.7,
          }}
        >
          {ctprvnSelected ? '구·군·시 단위로 더 좁힐 수 있어요.' : '위에서 지역을 먼저 선택해 주세요.'}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 0.75,
            mb: 1,
            opacity: ctprvnSelected ? 1 : 0.55,
          }}
        >
          {draft.sggCd && selectedSggLabel ? (
            <Chip
              label={selectedSggLabel}
              size="small"
              variant="outlined"
              sx={{
                height: 32,
                borderRadius: 9999,
                fontWeight: 600,
                fontSize: '0.8125rem',
                borderColor: colors.gray[200],
                bgcolor: tokens.bg.paper,
                color: colors.gray[800],
                '& .MuiChip-label': { px: 1.5 },
              }}
            />
          ) : (
            <Typography variant="caption" component="span" sx={{ color: colors.gray[500], fontSize: '0.8125rem' }}>
              {ctprvnSelected ? '선택 안 함' : '—'}
            </Typography>
          )}
        </Box>
        <List
          dense
          disablePadding
          sx={{
            mb: 1,
            maxHeight: 132,
            overflow: 'auto',
            border: `1px solid ${colors.gray[200]}`,
            borderRadius: `${radius.md}px`,
            opacity: ctprvnSelected ? 1 : 0.45,
            pointerEvents: ctprvnSelected ? 'auto' : 'none',
          }}
        >
          <ListItemButton
            selected={!draft.sggCd}
            disabled={!ctprvnSelected}
            onClick={() => setDraft((d) => ({ ...d, sggCd: '' }))}
            sx={{ fontSize: appMobileType.filterListItem.fontSize, py: 1 }}
          >
            미선택
          </ListItemButton>
          {sggOptions.map((opt) => {
            const val = opt.value ?? opt
            const sel = draft.sggCd === val
            return (
              <ListItemButton
                key={val}
                selected={sel}
                disabled={!ctprvnSelected}
                onClick={() => setDraft((d) => ({ ...d, sggCd: val }))}
                sx={{ fontSize: appMobileType.filterListItem.fontSize, py: 1, bgcolor: sel ? colors.blue.muted : undefined }}
              >
                {opt.label ?? opt.value ?? val}
              </ListItemButton>
            )
          })}
        </List>
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          px: 2.5,
          pt: 1.5,
          pb: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          borderTop: `1px solid ${colors.gray[200]}`,
          bgcolor: tokens.bg.paper,
        }}
      >
        <ThemeAppearanceControl compact />
        <Button
          fullWidth
          variant="contained"
          onClick={() => onApply({ ...draft })}
          sx={{
            py: 1.35,
            mt: 1,
            borderRadius: `${radius.md}px`,
            bgcolor: colors.blue.primary,
            fontWeight: 700,
            fontSize: '0.9375rem',
            textTransform: 'none',
            color: tokens.text.onPrimary,
            boxShadow: `0 2px 12px ${tokens.blue.glowSoft}`,
            '&:hover': { bgcolor: colors.blue.deep, boxShadow: `0 3px 16px ${tokens.blue.glowSoft}` },
          }}
        >
          적용하기
        </Button>
      </Box>
    </Drawer>
  )
}

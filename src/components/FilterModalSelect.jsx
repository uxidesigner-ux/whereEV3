import { useState, useMemo } from 'react'
import { Box, Button, Modal, TextField, List, ListItemButton, Typography } from '@mui/material'
import { colors, radius } from '../theme/dashboardTheme.js'

/**
 * 제목 + 요약 + "선택" 버튼. 클릭 시 모달에서 목록 선택.
 * searchable이면 모달 내 검색 필드 제공.
 */
export function FilterModalSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = '미선택',
  disabled = false,
  disabledMessage,
  searchable = false,
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selectedOption = options.find((o) => (o.value ?? o) === value)
  const summary = selectedOption ? (selectedOption.label ?? selectedOption.value ?? value) : placeholder

  const filteredOptions = useMemo(() => {
    if (!searchable || !search.trim()) return options
    const q = search.trim().toLowerCase()
    return options.filter((o) => {
      const l = (o.label ?? o.value ?? '').toString().toLowerCase()
      return l.includes(q)
    })
  }, [options, search, searchable])

  const handleSelect = (v) => {
    onChange(v)
    setOpen(false)
    setSearch('')
  }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ color: colors.gray[700], fontWeight: 600 }}>
          {label}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          disabled={disabled}
          onClick={() => setOpen(true)}
          sx={{
            minWidth: 0,
            py: 0.25,
            px: 0.75,
            fontSize: '0.75rem',
            textTransform: 'none',
            borderColor: colors.gray[300],
            color: colors.gray[700],
            '&:hover': { borderColor: colors.gray[400], bgcolor: 'rgba(0,0,0,0.02)' },
          }}
        >
          {disabled && disabledMessage ? disabledMessage : summary}
        </Button>
      </Box>

      <Modal open={open} onClose={() => { setOpen(false); setSearch('') }}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(360px, 92vw)',
            maxHeight: 'min(70dvh, 70vh)',
            bgcolor: 'background.paper',
            borderRadius: `${radius.md}px`,
            boxShadow: '0 8px 32px rgba(15,23,42,0.12)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: 2,
            boxSizing: 'border-box',
          }}
        >
          {/* 헤더: 제목 + 검색(있을 때) */}
          <Box
            sx={{
              flexShrink: 0,
              paddingBottom: 1.5,
              marginBottom: 1,
              borderBottom: `1px solid ${colors.gray[200]}`,
            }}
          >
            <Typography variant="subtitle2" sx={{ color: colors.gray[700], marginBottom: searchable ? 1 : 0 }}>
              {label}
            </Typography>
            {searchable && (
              <TextField
                size="small"
                placeholder="검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                fullWidth
                autoFocus
                sx={{
                  '& .MuiInputBase-root': { fontSize: '0.875rem' },
                  '& .MuiOutlinedInput-input': { py: 1 },
                }}
              />
            )}
          </Box>
          {/* 리스트 본문 */}
          <List
            dense
            sx={{
              overflow: 'auto',
              flex: 1,
              minHeight: 0,
              py: 0,
              paddingTop: 0.5,
              paddingBottom: 0.5,
              '& .MuiListItemButton-root': {
                fontSize: '0.8125rem',
                lineHeight: 1.4,
                paddingTop: 0.75,
                paddingBottom: 0.75,
                borderRadius: 0.5,
              },
            }}
          >
            <ListItemButton
              selected={!value}
              onClick={() => handleSelect('')}
            >
              전체
            </ListItemButton>
            {filteredOptions.map((opt) => {
              const v = opt.value ?? opt
              const isSelected = value === v
              return (
                <ListItemButton
                  key={v}
                  selected={isSelected}
                  onClick={() => handleSelect(v)}
                  sx={{
                    bgcolor: isSelected ? colors.blue.muted : undefined,
                  }}
                >
                  {opt.label ?? opt.value ?? v}
                </ListItemButton>
              )
            })}
          </List>
        </Box>
      </Modal>
    </>
  )
}

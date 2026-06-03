'use client'

import { useState, useEffect } from 'react'
import { Loader2, Mail, Phone, Send, User, Briefcase } from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { getSignContactOptions, startSignWithChannel } from '@/src/api/documents.api'
import type { SignChannel, SignContactOptions, Document } from '@/src/models/documents.model'

interface SendForSignatureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: Document | null
  onSuccess?: () => void
  docTypeLabel?: string
}

export function SendForSignatureModal({
  open,
  onOpenChange,
  document,
  onSuccess,
  docTypeLabel,
}: SendForSignatureModalProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [contactOptions, setContactOptions] = useState<SignContactOptions | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<SignChannel>('sms')
  const [manualPhone, setManualPhone] = useState('')
  const [manualEmail, setManualEmail] = useState('')

  // Load contact options when modal opens
  useEffect(() => {
    if (open && document) {
      loadContactOptions()
    }
  }, [open, document])

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setContactOptions(null)
      setSelectedChannel('sms')
      setManualPhone('')
      setManualEmail('')
    }
  }, [open])

  const loadContactOptions = async () => {
    if (!document) return

    setLoading(true)
    try {
      const options = await getSignContactOptions(document.id)
      setContactOptions(options)

      // Initialize manual values with defaults
      setManualPhone(options.default_phone || '')
      setManualEmail(options.default_email || '')

      // Set default channel based on backend preference
      if (options.preferred_channel) {
        setSelectedChannel(options.preferred_channel)
      } else if (options.available_channels.includes('sms')) {
        setSelectedChannel('sms')
      } else if (options.available_channels.includes('email')) {
        setSelectedChannel('email')
      }
    } catch (error: any) {
      console.error('Error loading contact options:', error)
      toast.error(error?.message || 'Ошибка загрузки контактов')
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!document || !contactOptions) return

    // Validation
    if (selectedChannel === 'sms') {
      if (!manualPhone) {
        toast.error('Укажите номер телефона')
        return
      }
    }

    if (selectedChannel === 'email') {
      if (!manualEmail) {
        toast.error('Укажите email адрес')
        return
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(manualEmail)) {
        toast.error('Введите корректный email адрес')
        return
      }
    }

    setSubmitting(true)
    try {
      const payload: any = { channel: selectedChannel }

      // Include manual values if they differ from defaults
      if (selectedChannel === 'sms') {
        if (manualPhone && manualPhone !== contactOptions.default_phone) {
          payload.manual_phone = manualPhone
        }
      }
      if (selectedChannel === 'email') {
        if (manualEmail && manualEmail !== contactOptions.default_email) {
          payload.manual_email = manualEmail
        }
      }

      const result = await startSignWithChannel(document.id, payload)

      toast.success('Ссылка и код отправлены клиенту')
      onSuccess?.()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error sending for signature:', error)
      toast.error(error?.message || 'Ошибка отправки на подпись')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Отправить документ на подпись
            </div>
          </DialogTitle>
          <DialogDescription>
            Документ #{document?.id} — {docTypeLabel || document?.doc_type}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">Загрузка контактов...</p>
          </div>
        ) : contactOptions ? (
          <div className="space-y-5">
            {/* Channel Selection */}
            <div className="space-y-2">
              <Label>Способ отправки</Label>
              <Tabs
                value={selectedChannel}
                onValueChange={(value) => setSelectedChannel(value as SignChannel)}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  {contactOptions.available_channels.includes('sms') && (
                    <TabsTrigger value="sms" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      SMS
                    </TabsTrigger>
                  )}
                  {contactOptions.available_channels.includes('email') && (
                    <TabsTrigger value="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
            </div>

            {/* Phone Field - shown only for SMS */}
            {selectedChannel === 'sms' && (
              <div className="space-y-2">
                <Label htmlFor="phone">Номер телефона</Label>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+7 700 123 4567"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {contactOptions.default_phone
                    ? 'Номер клиента (можно изменить)'
                    : 'Введите номер для отправки SMS'}
                </p>
              </div>
            )}

            {/* Email Field - shown only for Email */}
            {selectedChannel === 'email' && (
              <div className="space-y-2">
                <Label htmlFor="email">Email адрес</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="client@example.com"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {contactOptions.default_email
                    ? 'Email клиента (можно изменить)'
                    : 'Введите email для отправки'}
                </p>
              </div>
            )}

            {/* Optional: Signatory Info */}
            {(contactOptions.resolved_full_name || contactOptions.resolved_position) && (
              <div className="space-y-3 pt-2 border-t">
                {contactOptions.resolved_full_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">ФИО:</span>
                    <span className="font-medium">{contactOptions.resolved_full_name}</span>
                  </div>
                )}
                {contactOptions.resolved_position && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Должность:</span>
                    <span className="font-medium">{contactOptions.resolved_position}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || submitting}
            className="min-w-[140px]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Отправить на подпись
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

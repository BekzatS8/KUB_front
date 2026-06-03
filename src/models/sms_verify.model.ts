export type SMS_Verify_Send_SMS_Request = {
  document_id: number
  phone: string
}

export type SMS_Verify_Resend_SMS_Request = {
  document_id: number
}

export type SMS_Verify_Confirm_SMS_Request = {
  document_id: number
  code: string
}

// รายชื่อ email template ดูจาก link นี้ : https://dashboard.thaibulksms.com/email-template-management/?tab=custom
export enum EmailTemplateID {
    SUCCESSFUL_PAYMENT = '25111913-3740-8f8a-a1b5-da0742dec042',
    NEW_MESSAGE = '25121720-3304-836d-9860-a8ef814f8bc1',
}

// ดูรายละเอียดได้ตรงนี้
// https://developer.thaibulksms.com/reference/transactionalcontroller_send-1
export interface SendEmailPayload {
    template_uuid: EmailTemplateID;
    mail_from: { email: string; name?: string };
    mail_to: { email: string } | Array<{ email: string }>;
    subject: string;
    payload?: Record<string, unknown>;
}

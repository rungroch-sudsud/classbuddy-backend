import { createZodDto } from 'nestjs-zod';
import { businessConfig } from 'src/configs/business.config';
import { z } from 'zod';

export const CreateCourseSchema = z.object({
    subjectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'รหัสวิชาไม่ถูกต้อง'),
    courseName: z.string().min(1, 'กรุณากรอกชื่อคอร์สเรียน'),
    courseGoal: z.string().min(1, 'กรุณากรอกเป้าหมายของคอร์ส'),
    courseTotalHours: z
        .number({ message: 'กรุณากรอกจำนวนชั่วโมงรวม' })
        .min(businessConfig.course.minimumHours, 'กรุณากรอกจำนวนชั่วโมงรวม')
        .max(
            businessConfig.course.maximumHours,
            `ชั่วโมงคอร์สเรียนไม่สามารถเกิน ${businessConfig.course.maximumHours} ชั่วโมงได้`,
        ),
    price: z
        .number({ message: 'กรุณากรอกราคาคอร์ส' })
        .min(
            businessConfig.course.minimumPriceBaht,
            `ราคาคอร์สเรียนขั้นต่ำ ${businessConfig.course.minimumPriceBaht} บาท`,
        )
        .max(
            businessConfig.course.maximumPriceBaht,
            `ราคาคอร์สไม่สามารถเกิน ${businessConfig.course.maximumPriceBaht} บาทได้`,
        ),
    courseDetail: z.string().min(1, 'กรุณากรอกรายละเอียดของคอร์ส'),
    issueCertificate: z.boolean().default(false),
});

export class CreateCourseDto extends createZodDto(CreateCourseSchema) {}

import { createZodDto } from 'nestjs-zod';
import { businessConfig } from 'src/configs/business.config';
import { z } from 'zod';
import { CourseStatus } from '../enums/course.enum';

export const CreateCourseSchema = z
    .object({
        subjectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'รหัสวิชาไม่ถูกต้อง'),
        courseName: z.string().min(1, 'กรุณากรอกชื่อคอร์สเรียน'),
        courseGoal: z.string().nullish(),
        courseTotalHours: z
            .number()
            .min(businessConfig.course.minimumHours, 'กรุณากรอกจำนวนชั่วโมงรวม')
            .max(
                businessConfig.course.maximumHours,
                `ชั่วโมงคอร์สเรียนไม่สามารถเกิน ${businessConfig.course.maximumHours} ชั่วโมงได้`,
            )
            .nullish(),
        price: z
            .number()
            .min(
                businessConfig.course.minimumPriceBaht,
                `ราคาคอร์สเรียนขั้นต่ำ ${businessConfig.course.minimumPriceBaht} บาท`,
            )
            .max(
                businessConfig.course.maximumPriceBaht,
                `ราคาคอร์สไม่สามารถเกิน ${businessConfig.course.maximumPriceBaht} บาทได้`,
            )
            .nullish(),
        courseDetail: z.string().nullish(),
        issueCertificate: z.boolean().default(false),
        status: z.nativeEnum(CourseStatus).default(CourseStatus.PUBLISHED),
    })
    .superRefine((data, ctx) => {
        if (data.status === CourseStatus.PUBLISHED) {
            const courseGoal = data.courseGoal?.trim();
            const courseGoalIsEmpty = courseGoal === '' || courseGoal === null;

            if (courseGoalIsEmpty) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'กรุณากรอกเป้าหมายของคอร์ส',
                    path: ['courseGoal'],
                });
            }

            const courseTotalHours = data.courseTotalHours;

            if (!courseTotalHours) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'กรุณากรอกจำนวนชั่วโมงรวม',
                    path: ['courseTotalHours'],
                });
            }

            const coursePriceIsEmpty =
                data.price === undefined || data.price === null;
                
            if (coursePriceIsEmpty) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'กรุณากรอกราคาคอร์ส',
                    path: ['price'],
                });
            }

            const courseDetail = data.courseDetail?.trim();
            const courseDetailIsEmpty =
                courseDetail === '' || courseDetail === null;

            if (courseDetailIsEmpty) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'กรุณากรอกรายละเอียดของคอร์ส',
                    path: ['courseDetail'],
                });
            }
        }
    });

export class CreateCourseDto extends createZodDto(CreateCourseSchema) {}

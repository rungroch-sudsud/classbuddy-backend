import { SubjectList } from 'src/modules/subjects/schemas/subject.schema';
import { Course } from './course.schema';
import { Teacher } from 'src/modules/teachers/schemas/teacher.schema';
import { User } from 'src/modules/users/schemas/user.schema';

export type CourseWithSubject = Omit<Course, 'subjectId'> & {
    subjectId: SubjectList;
};

export type CourseWithTeacherAndSubject = Omit<
    Course,
    'subjectId' | 'teacherId'
> & {
    subjectId: SubjectList;
    teacherId: Teacher & { userId: User };
};

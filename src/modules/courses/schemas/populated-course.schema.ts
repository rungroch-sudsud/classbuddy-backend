import { SubjectList } from 'src/modules/subjects/schemas/subject.schema';
import { Course } from './course.schema';

export type CourseWithSubject = Omit<Course, 'subjectId'> & {
    subjectId: SubjectList;
};

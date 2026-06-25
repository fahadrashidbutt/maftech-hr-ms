// src/seed.js
// Populates demo data: departments, users (one per role), employees, leave,
// a job opening with candidates. Run with `npm run seed`.
import bcrypt from 'bcryptjs';
import db from './db.js';

const reset = () => {
  ['notifications','audit_logs','documents','candidates','job_openings',
   'leave_requests','employees','users','departments'].forEach(t =>
    db.prepare(`DELETE FROM ${t}`).run());
};
reset();

const hash = (p) => bcrypt.hashSync(p, 10);

const deptIds = {};
['Engineering', 'Human Resources', 'Finance', 'Operations'].forEach(name => {
  deptIds[name] = db.prepare('INSERT INTO departments (name) VALUES (?)').run(name).lastInsertRowid;
});

function makeUser(email, role) {
  return db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?,?,?)')
    .run(email, hash('password123'), role).lastInsertRowid;
}

function makeEmployee(o) {
  return db.prepare(`
    INSERT INTO employees (user_id, employee_code, full_name, cnic, date_of_birth, gender,
      department_id, designation, manager_id, date_of_joining, probation_end, date_of_termination,
      salary, email, phone)
    VALUES (@user_id,@code,@name,@cnic,@dob,@gender,@dept,@designation,@manager,@doj,@prob,@contract,@salary,@email,@phone)
  `).run(o).lastInsertRowid;
}

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const offset = (days) => { const d = new Date(today); d.setDate(d.getDate() + days); return iso(d); };

// Super admin (no employee profile needed)
makeUser('admin@maftech.com', 'super_admin');

// HR
const hrUser = makeUser('hr@maftech.com', 'hr');
const hrEmp = makeEmployee({
  user_id: hrUser, code: 'EMP-001', name: 'Ayesha Khan', cnic: '35201-1111111-1',
  dob: '1990-06-26', gender: 'Female', dept: deptIds['Human Resources'], designation: 'HR Manager',
  manager: null, doj: '2021-03-01', prob: null, contract: null, salary: 220000,
  email: 'hr@maftech.com', phone: '0300-1112233',
});

// Manager (Engineering)
const mgrUser = makeUser('manager@maftech.com', 'manager');
const mgrEmp = makeEmployee({
  user_id: mgrUser, code: 'EMP-002', name: 'Bilal Ahmed', cnic: '35201-2222222-2',
  dob: '1988-01-15', gender: 'Male', dept: deptIds['Engineering'], designation: 'Engineering Lead',
  manager: null, doj: '2020-07-10', prob: null, contract: offset(20), salary: 300000,
  email: 'manager@maftech.com', phone: '0300-2223344',
});

// Employee (reports to manager)
const empUser = makeUser('employee@maftech.com', 'employee');
const empEmp = makeEmployee({
  user_id: empUser, code: 'EMP-003', name: 'Hira Saleem', cnic: '35201-3333333-3',
  dob: offset(3), gender: 'Female', dept: deptIds['Engineering'], designation: 'Software Engineer',
  manager: mgrEmp, doj: offset(-10), prob: offset(10), contract: offset(120), salary: 140000,
  email: 'employee@maftech.com', phone: '0300-3334455',
});

// A couple more employees for the directory
makeEmployee({ user_id: null, code: 'EMP-004', name: 'Usman Tariq', cnic: null, dob: '1995-09-02',
  gender: 'Male', dept: deptIds['Engineering'], designation: 'QA Engineer', manager: mgrEmp,
  doj: offset(-5), prob: offset(25), contract: offset(15), salary: 120000, email: 'usman@maftech.com', phone: null });
makeEmployee({ user_id: null, code: 'EMP-005', name: 'Sana Yousuf', cnic: null, dob: '1992-03-19',
  gender: 'Female', dept: deptIds['Finance'], designation: 'Accountant', manager: null,
  doj: '2022-01-12', prob: null, contract: null, salary: 160000, email: 'sana@maftech.com', phone: null });

// A pending leave request from the employee
db.prepare(`INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
  VALUES (?,?,?,?,?)`).run(empEmp, 'annual', offset(3), offset(5), 'Family event');
// An approved one that is active today (shows up in "on leave today")
db.prepare(`INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status, decided_by, decided_at)
  VALUES (?,?,?,?,?, 'approved', ?, datetime('now'))`)
  .run(empEmp, 'sick', offset(-1), offset(1), 'Flu', mgrEmp);

// Recruitment
const jobId = db.prepare('INSERT INTO job_openings (title, department_id, description) VALUES (?,?,?)')
  .run('Backend Developer', deptIds['Engineering'], 'Node.js / SQL, 2+ years experience.').lastInsertRowid;
db.prepare('INSERT INTO candidates (job_id, full_name, email, status) VALUES (?,?,?,?)')
  .run(jobId, 'Kamran Ali', 'kamran@example.com', 'applied');
db.prepare('INSERT INTO candidates (job_id, full_name, email, status) VALUES (?,?,?,?)')
  .run(jobId, 'Nida Raza', 'nida@example.com', 'shortlisted');

console.log('Seed complete.');
console.log('Demo accounts (password: password123):');
console.log('  admin@maftech.com     (Super Administrator)');
console.log('  hr@maftech.com        (HR)');
console.log('  manager@maftech.com   (Manager – Engineering)');
console.log('  employee@maftech.com  (Employee)');

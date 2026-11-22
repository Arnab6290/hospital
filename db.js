// Demo database for the website.
// There is no MySQL here, so the data is kept in the browser (localStorage).
// It follows the same rules as the sql script: no double booking for the same
// doctor and slot, confirm + bill together, reports, csv import and so on.

const STORE_KEY = 'hospital_demo_data_v1';
let memoryData = null;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dateStr(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ---------- sample data ----------

function makeSeedData() {
  // small random generator so the sample data is the same every time
  let seed = 11;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }
  function pick(list) {
    return list[Math.floor(rand() * list.length)];
  }

  const deptNames = ['Cardiology', 'ENT', 'Paediatrics', 'Orthopaedics',
                     'Dermatology', 'Neurology', 'Gynaecology', 'General Medicine'];
  const doctorList = [
    ['Dr. Arup Rao', 1, 800], ['Dr. Sameer Ali', 1, 850],
    ['Dr. Mina Sen', 2, 500], ['Dr. Tapan Basu', 2, 450],
    ['Dr. Joy Mitra', 3, 600], ['Dr. Ritu Ghosh', 3, 550],
    ['Dr. Kavita Nair', 4, 700], ['Dr. Rajesh Iyer', 4, 750],
    ['Dr. Sneha Pillai', 5, 500], ['Dr. Anil Kapoor', 5, 600],
    ['Dr. Debashis Roy', 6, 900], ['Dr. Farah Khan', 6, 950],
    ['Dr. Lata Menon', 7, 650], ['Dr. Shruti Joshi', 7, 700],
    ['Dr. Gopal Verma', 8, 300], ['Dr. Nisha Agarwal', 8, 350]
  ];
  const firstNames = ['Ravi', 'Pooja', 'Amit', 'Neha', 'Sourav', 'Priya', 'Rahul', 'Anita', 'Vikram',
                      'Sunita', 'Manoj', 'Kiran', 'Deepak', 'Rekha', 'Suresh', 'Meera', 'Arjun',
                      'Kavya', 'Imran', 'Sana'];
  const lastNames = ['Kumar', 'Das', 'Ghosh', 'Roy', 'Dey', 'Sharma', 'Singh', 'Paul', 'Bose',
                     'Mukherjee', 'Sen', 'Khan', 'Nair', 'Reddy', 'Chatterjee'];

  const data = { departments: [], doctors: [], patients: [], appointments: [], bills: [] };

  deptNames.forEach((name, i) => data.departments.push({ dept_id: i + 1, name: name }));
  doctorList.forEach((d, i) => data.doctors.push({ doctor_id: i + 1, name: d[0], dept_id: d[1], fee: d[2] }));

  const used = {};
  while (data.patients.length < 60) {
    const name = pick(firstNames) + ' ' + pick(lastNames);
    if (used[name]) continue;
    used[name] = true;
    data.patients.push({
      patient_id: data.patients.length + 1,
      name: name,
      age: 2 + Math.floor(rand() * 80),
      phone: '98' + String(10000000 + Math.floor(rand() * 89999999))
    });
  }

  // time slots 09:00 to 16:30
  const slots = [];
  for (let h = 9; h < 17; h++) {
    slots.push(pad2(h) + ':00:00');
    slots.push(pad2(h) + ':30:00');
  }

  // two different slots for one doctor on one day
  function twoSlots() {
    const a = Math.floor(rand() * slots.length);
    const b = (a + 1 + Math.floor(rand() * (slots.length - 1))) % slots.length;
    return rand() < 0.5 ? [slots[a]] : [slots[a], slots[b]];
  }

  function addAppointment(patient, doctor, date, slot, status) {
    data.appointments.push({
      appt_id: data.appointments.length + 1,
      patient_id: patient,
      doctor_id: doctor,
      appt_date: date,
      slot: slot,
      status: status
    });
  }

  // last 6 months (confirmed or cancelled)
  for (let back = 180; back >= 1; back--) {
    const day = daysAgo(back);
    if (day.getDay() === 0) continue;      // no appointments on sunday
    data.doctors.forEach(doc => {
      if (rand() < 0.075) {
        twoSlots().forEach(slot => {
          const status = rand() < 0.12 ? 'CANCELLED' : 'CONFIRMED';
          addAppointment(1 + Math.floor(rand() * 60), doc.doctor_id, dateStr(day), slot, status);
        });
      }
    });
  }

  // a bill for every old confirmed appointment
  data.appointments.forEach(a => {
    if (a.status === 'CONFIRMED') {
      const doc = data.doctors[a.doctor_id - 1];
      data.bills.push({
        bill_id: data.bills.length + 1,
        appt_id: a.appt_id,
        amount: doc.fee,
        billed_on: a.appt_date + ' ' + a.slot
      });
    }
  });

  // today's appointments, all pending
  const today = dateStr(new Date());
  data.doctors.forEach(doc => {
    twoSlots().forEach(slot => {
      addAppointment(1 + Math.floor(rand() * 60), doc.doctor_id, today, slot, 'PENDING');
    });
  });

  return data;
}

// ---------- saving and loading ----------

function saveData() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(memoryData));
  } catch (e) {
    // private mode etc. - the data then only lives until the page is closed
  }
}

function loadData() {
  if (memoryData) return memoryData;
  try {
    const text = localStorage.getItem(STORE_KEY);
    if (text) memoryData = JSON.parse(text);
  } catch (e) {}
  if (!memoryData) {
    memoryData = makeSeedData();
    saveData();
  }
  return memoryData;
}

function resetDemoData() {
  memoryData = makeSeedData();
  saveData();
}

// ---------- the "api" used by app.js ----------

function nextId(list, key) {
  let max = 0;
  list.forEach(x => { if (x[key] > max) max = x[key]; });
  return max + 1;
}

async function demoApi(url, options) {
  const data = loadData();
  const method = (options && options.method) || 'GET';
  const body = options && options.body ? JSON.parse(options.body) : {};
  const u = new URL(url, 'http://demo.local');
  const path = u.pathname;
  const today = dateStr(new Date());

  const doctorOf = id => data.doctors.find(d => d.doctor_id == id);
  const patientOf = id => data.patients.find(p => p.patient_id == id);
  const deptOf = id => data.departments.find(d => d.dept_id == id);

  // ----- dashboard -----
  if (path === '/api/stats') {
    const month = today.slice(0, 7);
    let revenue = 0;
    data.bills.forEach(b => { if (b.billed_on.slice(0, 7) === month) revenue += b.amount; });
    return {
      doctors: data.doctors.length,
      patients: data.patients.length,
      today: data.appointments.filter(a => a.appt_date === today && a.status !== 'CANCELLED').length,
      revenue_month: revenue
    };
  }

  if (path === '/api/today') {
    const rows = data.doctors.map(d => ({
      doctor_id: d.doctor_id,
      doctor: d.name,
      department: deptOf(d.dept_id).name,
      appointments_today: data.appointments.filter(a =>
        a.doctor_id === d.doctor_id && a.appt_date === today && a.status !== 'CANCELLED').length
    }));
    rows.sort((a, b) => b.appointments_today - a.appointments_today || a.doctor.localeCompare(b.doctor));
    return rows;
  }

  // ----- patients and doctors -----
  if (path === '/api/patients') {
    return data.patients.slice().sort((a, b) => a.name.localeCompare(b.name))
      .map(p => ({ patient_id: p.patient_id, name: p.name }));
  }

  if (path === '/api/doctors' && method === 'GET') {
    return data.doctors.map(d => ({
      doctor_id: d.doctor_id, name: d.name, department: deptOf(d.dept_id).name, fee: d.fee
    }));
  }

  if (path === '/api/doctors/import') {
    const lines = (body.csv || '').split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
    if (lines.length < 2) throw new Error('The file is empty or has no data rows');

    const header = lines.shift().toLowerCase().split(',').map(h => h.trim());
    const iName = header.indexOf('name');
    const iDept = header.indexOf('dept_id');
    const iFee = header.indexOf('fee');
    if (iName < 0 || iDept < 0 || iFee < 0) throw new Error('First line must be: name,dept_id,fee');

    // check every line first, so nothing is added if one line is wrong
    const newDoctors = lines.map((line, i) => {
      const parts = line.split(',').map(p => p.trim());
      const name = parts[iName];
      const dept = Number(parts[iDept]);
      const fee = Number(parts[iFee]);
      if (!name || !Number.isInteger(dept) || isNaN(fee)) {
        throw new Error('Line ' + (i + 2) + ' is not valid: ' + line);
      }
      if (!deptOf(dept)) {
        throw new Error('Line ' + (i + 2) + ': department ' + dept + ' does not exist');
      }
      return { name: name, dept_id: dept, fee: fee };
    });

    newDoctors.forEach(d => {
      d.doctor_id = nextId(data.doctors, 'doctor_id');
      data.doctors.push(d);
    });
    saveData();
    return { added: newDoctors.length };
  }

  // ----- appointments -----
  if (path === '/api/appointments' && method === 'GET') {
    const date = u.searchParams.get('date');
    const status = u.searchParams.get('status');
    const rows = data.appointments
      .filter(a => (!date || a.appt_date === date) && (!status || a.status === status))
      .map(a => ({
        appt_id: a.appt_id,
        patient: patientOf(a.patient_id).name,
        doctor: doctorOf(a.doctor_id).name,
        department: deptOf(doctorOf(a.doctor_id).dept_id).name,
        appt_date: a.appt_date,
        slot: a.slot,
        status: a.status
      }));
    rows.sort((a, b) => b.appt_date.localeCompare(a.appt_date) || a.slot.localeCompare(b.slot) || a.appt_id - b.appt_id);
    return rows.slice(0, 300);
  }

  if (path === '/api/appointments' && method === 'POST') {
    if (!body.patient_id || !body.doctor_id || !body.appt_date || !body.slot) {
      throw new Error('Please fill in all the fields');
    }
    const slot = body.slot.length === 5 ? body.slot + ':00' : body.slot;

    // same job as the trigger: block two bookings for the same doctor and slot
    const clash = data.appointments.some(a =>
      a.doctor_id == body.doctor_id && a.appt_date === body.appt_date &&
      a.slot === slot && a.status !== 'CANCELLED');
    if (clash) throw new Error('Doctor already has an appointment in this slot');

    data.appointments.push({
      appt_id: nextId(data.appointments, 'appt_id'),
      patient_id: Number(body.patient_id),
      doctor_id: Number(body.doctor_id),
      appt_date: body.appt_date,
      slot: slot,
      status: 'PENDING'
    });
    saveData();
    return { ok: true };
  }

  const m = path.match(/^\/api\/appointments\/(\d+)\/(confirm|cancel)$/);
  if (m && method === 'POST') {
    const appt = data.appointments.find(a => a.appt_id == m[1]);

    if (m[2] === 'confirm') {
      // same job as confirm_appointment: check, confirm and create the bill together
      if (!appt) throw new Error('Appointment not found');
      if (appt.status !== 'PENDING') throw new Error('Only a pending appointment can be confirmed');
      const now = new Date();
      appt.status = 'CONFIRMED';
      data.bills.push({
        bill_id: nextId(data.bills, 'bill_id'),
        appt_id: appt.appt_id,
        amount: doctorOf(appt.doctor_id).fee,
        billed_on: dateStr(now) + ' ' + pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds())
      });
    } else {
      if (!appt || appt.status !== 'PENDING') throw new Error('Only a pending appointment can be cancelled');
      appt.status = 'CANCELLED';
    }
    saveData();
    return { ok: true };
  }

  // ----- bills -----
  if (path === '/api/bills') {
    return data.bills.slice().sort((a, b) => b.bill_id - a.bill_id).map(b => {
      const appt = data.appointments.find(a => a.appt_id === b.appt_id);
      return {
        bill_id: b.bill_id,
        patient: patientOf(appt.patient_id).name,
        doctor: doctorOf(appt.doctor_id).name,
        appt_date: appt.appt_date,
        amount: b.amount,
        billed_on: b.billed_on
      };
    });
  }

  // ----- reports -----
  if (path === '/api/reports/departments') {
    return data.departments.map(dp => {
      const seen = {};
      data.appointments.forEach(a => {
        if (a.status !== 'CANCELLED' && doctorOf(a.doctor_id).dept_id === dp.dept_id) seen[a.patient_id] = true;
      });
      return { department: dp.name, patients: Object.keys(seen).length };
    }).sort((a, b) => b.patients - a.patients);
  }

  if (path === '/api/reports/workload') {
    return data.doctors.map(d => ({
      doctor: d.name,
      appointments: data.appointments.filter(a => a.doctor_id === d.doctor_id && a.status !== 'CANCELLED').length
    })).sort((a, b) => b.appointments - a.appointments);
  }

  if (path === '/api/reports/revenue') {
    const months = {};
    data.bills.forEach(b => {
      const key = b.billed_on.slice(0, 7);
      if (!months[key]) months[key] = { month: key, bills: 0, revenue: 0 };
      months[key].bills += 1;
      months[key].revenue += b.amount;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }

  throw new Error('Unknown request: ' + path);
}

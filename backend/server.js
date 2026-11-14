require('dotenv').config();
const express = require('express');
const cors = require('cors');

const profileRoutes = require('./routes/profile');
const doctorsRoutes = require('./routes/doctors');
const appointmentsRoutes = require('./routes/appointments');
const recordsRoutes = require('./routes/records');
const remindersRoutes = require('./routes/reminders');
const adminRoutes = require('./routes/admin');
const triageRoutes = require('./routes/triage');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'EzRemedy API' });
});

app.use('/api/profile', profileRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/triage', triageRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`EzRemedy backend listening on http://localhost:${PORT}`);
});

require('dotenv').config({ path: './.env' });
// Set DNS servers early to fix MongoDB SRV connection issues
const dns = require('dns');
dns.setServers([
  "8.8.8.8",      // Google DNS
  "8.8.4.4",      // Google DNS secondary
  "1.1.1.1",      // Cloudflare DNS
  "1.0.0.1"       // Cloudflare DNS secondary
]);

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');


const indexRouter = require('./routes/index.routes');


require("./utils/config.db")();
require("./utils/admin.autoregister").AdminRegisterAuto();
require("./utils/levelIncome.calculation");
require("./utils/dailyCron");
// Import the cron jobs
require("./cron/combined.daily.cron");
require("./cron/teamShuffle.cron"); // Weekly team shuffling - Monday 3 AM IST
require("./cron/monthly.roi.cron"); // Monthly ROI on 15th of every month
require("./cron/rankCheck.cron"); // Daily rank check - 2 AM IST
// require("./cron/roi.cron")
// require("./cron/daily.cron")
// require("./data");

const app = express();




app.use(cors({ credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE'], origin: true, allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
if (!process.env.SESSION_SECRET) {
  console.error('ERROR: SESSION_SECRET environment variable is required. Please add it to your .env file.');
  process.exit(1);
}

app.use(session({ name: "ico", secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true, cookie: { httpOnly: true, secure: false, maxAge: 1 * 24 * 60 * 60 * 1000 }, store: MongoStore.create({ mongoUrl: process.env.DATABASE_URL, autoRemove: 'disabled' }) }));

app.use('/api', indexRouter);

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();// view engine setup
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'ejs');
});
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Mount ROI Test routes
app.use("/api/dummy", require("./routes/dummy.route"));
app.use("/api/roi-test", require("./routes/roiTest.route"));




// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});
console.log("Server is running on port " + process.env.PORT);

module.exports = app;

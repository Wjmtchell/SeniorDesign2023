const express = require('express');
const session = require('express-session');
const path = require('path');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const i18next = require('i18next');
const Backend = require('i18next-locize-backend');
const i18nextMiddleware= require('i18next-http-middleware');
const PORT = process.env.PORT || 5001;
i18next
    .use(Backend)
    .use(i18nextMiddleware.LanguageDetector)
    .init({
        lng:'en',
        fallbackLng: 'en',
        debug: true,
        saveMissing: true,
        backend:{
            projectId: '3cc31e1c-db80-4280-a832-13111693710a',
            apiKey: '640ced37-c6a4-49ce-8d31-4be7f1879971',
            referenceLng: 'en',
            version:'latest'
        },
    });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

function getCurrentMonth() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  return `${currentYear}-${currentMonth}`;
}

express()
  .use(i18nextMiddleware.handle(i18next))
  .use((req, res, next) => {
    // Pass i18next instance to the template
    res.locals.i18next = i18next;
    console.log('i18next in locals:', res.locals.i18next); // Add this line for debuggin
    next();
  })
  .use(express.static(path.join(__dirname, 'public')))
  .use(bodyParser.urlencoded({extended:false}))
  .use(session({secret:'Hello World', resave:true,saveUninitialized:true}))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/change-language', async(req, res) => {
    const { lng } = req.query;
    if (lng) {
      i18next.changeLanguage(lng);
    }
    await i18next.reloadResources();
    res.redirect('back'); // Redirect back to the previous page
  })
  .get('/', (req, res) => {
    const message = req.query.message || '';
    const user = req.session.user;
    res.render('pages/main_menu', {user, message});})
  .get('/login', (req,res)=> {
    const message = req.query.message || '';
    const user = req.session.user;
    res.render("pages/login", {user, message});})
  .get('/student_list', async (req,res)=> {
    const message = req.query.message || '';
    const user = req.session.user;
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT * FROM users WHERE type = 3');
      const results = { 'results': (result) ? result.rows : null};
      res.render('pages/student_list', {results,user});
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }})
  .get('/student_edit', (req,res)=> {
    const message = req.query.message || '';
    const user = req.session.user;
    res.render("pages/student_edit", {user, message});})
  .get('/employee_list', async (req,res)=> {
    const message = req.query.message || '';
    const user = req.session.user;
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT * FROM users WHERE type = 2');
      const results = { 'results': (result) ? result.rows : null};
      res.render('pages/employee_list', {results,user});
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
    })
  .get('/employee_edit', (req,res)=> {
    const message = req.query.message || '';
    const user = req.session.user;
    res.render("pages/employee_edit", {user,message});})
  .post('/login/auth', async (req,res)=>{
    const {username, password} = req.body;
    try {
      const values = [username,password];
      const client = await pool.connect();
      const result = await client.query('SELECT * FROM users WHERE username = $1 AND password= $2', values);
      if (result.rows.length===1){
        req.session.user = username;
        req.session.type = result.rows[0].type;
        if(result.rows[0].type ==1){ 
          res.redirect('/admin?message=Login%20Successful.%20Welcome%20Admin');
          client.release();
        } else{ 
        
          res.redirect('/?message=Login%20Successful.%20Welcome.');
          client.release();
        }
      } else {
       
       //res.send('Login failed. Please make sure you have entered the correct username and password');
        res.redirect('/login?message=Login Failed');
        
      }
    } catch (error) {
      console.error('Login error', error);
      res.status(500).send('Database Connection Failed');
    }
  })
  .get('/admin', async (req, res) => {
    const user = req.session.user;
    if(req.session.type != 1){
      res.redirect('/?message=You%20are%20not%20authorized%20to%20access%20that%20page.')
    }else{
      try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM users');
        const results = { 'results': (result) ? result.rows : null};
        res.render('pages/db', {results,user});
        client.release();
      } catch (err) {
        console.error(err);
        res.send("Error " + err);
      }
    }})
  .get('/admin/add', async (req,res)=>{
    res.render('pages/add_user')
  })
  .post('/admin/add', async (req,res)=> {
    const {username,password,type,firstName, lastName, dob, emergencyContact, emergencyPhone, bio } = req.body;
    try {
      const client = await pool.connect();
      await client.query(
        'INSERT INTO users (username, password, type, given_name, surname, dob, emergency_contact, emergency_phone,bio) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [username,password,type, firstName, lastName, dob, emergencyContact, emergencyPhone,bio]
      );
      res.redirect(`/admin?message=User%20Added%20Successfully`);
      client.release();
    } catch (error) {
      console.error('Error adding User:', error);
      res.redirect('/admin?message=Error%20Adding%20Student');
    }
  })
  .get('/student/:id', async (req,res)=>{
    const id= req.params.id;
    const values = [id];
    const user = req.session.user;
    const type = req.session.type || 0;
     try {
       const client = await pool.connect();
       const result = await client.query('SELECT * FROM users WHERE id=($1) AND type=3',values);
       const tuition = await client.query('SELECT * FROM tuition WHERE uid=($1)',values);
       const tuitionResults = { 'tuitionResults': (tuition) ? tuition.rows : null};
       const meals = await client.query('SELECT * FROM meals WHERE uid=($1)',values);
       const mealsResults = { 'mealsResults': (meals) ? meals.rows : null};
       const studentInfo = result.rows[0];
       res.render('pages/student_info', {studentInfo,user,tuitionResults,mealsResults, id,type});
       client.release();
     } catch(error) {
       res.redirect('/?message=Failed%20To%20Find%20StudentInfo')
     }
  })
  .get('/employee/:id', async(req,res)=>{
    const id= req.params.id;
    const values = [id];
    const user = req.session.user;
    const type = req.session.type;
     try {
       const client = await pool.connect();
       const result = await client.query('SELECT * FROM users WHERE id=($1) AND type=2',values);
       const pay = await client.query('SELECT * FROM salaries WHERE uid=($1)',values);
       const payResults = { 'payResults': (pay) ? pay.rows : null};
       const employeeInfo = result.rows[0];
       res.render('pages/employee_info', {employeeInfo,user,payResults, id, type});
       client.release();
     } catch(error) {
       res.redirect('/?message=Failed%20To%20Find%20EmployeeInfo')
     }
  })
  // Not Yet implemented
  // .post('/edit-bio/:id', async (req, res) => {
  // const studentId = req.params.id;
  // const newBio = req.body.newBio;

  // try {
  //     const client = await pool.connect();
  //     await client.query('UPDATE student_info SET bio = $1 WHERE uid = $2', [newBio, studentId]);

  //     // Redirect back to the student_info page after updating the biography
  //     res.redirect(`/student/${studentId}?message=Biography%20Updated&id=${studentId}`);
  //     client.release();
  // } catch (error) {
  //     console.error('Error updating biography:', error);
  //     res.redirect(`/student/${studentId}?message=Error%20Updating%20Biography&id=${studentId}`);
  // }
  // })
  .post('/add-tuition/:id', async (req, res) => {
    const studentId = req.params.id;
    const { tuitionCharge, tuitionDate } = req.body;

    try {
        const client = await pool.connect();
        await client.query(
            'INSERT INTO tuition (uid, charge, date) VALUES ($1, $2, $3)',
            [studentId, tuitionCharge, tuitionDate]
        );

        res.redirect(`/student/${studentId}?message=Tuition%20Charge%20Added&id=${studentId}`);
        client.release();
    } catch (error) {
        console.error('Error adding tuition charge:', error);
        res.redirect(`/student/${studentId}?message=Error%20Adding%20Tuition%20Charge&id=${studentId}`);
    }
})

// Add Meal POST route
.post('/add-meal/:id', async (req, res) => {
    const studentId = req.params.id;
    const { mealCharge, mealDate } = req.body;

    try {
        const client = await pool.connect();
        await client.query(
            'INSERT INTO meals (uid, charge, date) VALUES ($1, $2, $3)',
            [studentId, mealCharge, mealDate]
        );

        res.redirect(`/student/${studentId}?message=Meal%20Charge%20Added&id=${studentId}`);
        client.release();
    } catch (error) {
        console.error('Error adding meal charge:', error);
        res.redirect(`/student/${studentId}?message=Error%20Adding%20Meal%20Charge&id=${studentId}`);
    }
  })
  .get('/student/:id/monthly-summary', async(req,res)=> {
    const selectedMonth = req.query.month || getCurrentMonth();
    const studentId = req.params.id;
    const user = req.session.user;
    const startDate = `${selectedMonth}-01`;
    const lastDay = new Date(new Date(selectedMonth + '-01').getFullYear(), new Date(selectedMonth + '-01').getMonth() + 1, 0);
    const endDate = lastDay.toISOString().split('T')[0];
    const tuitionQuery = `
        SELECT *
        FROM tuition
        WHERE uid=$3 AND TO_DATE(date, 'YYYY-MM-DD') BETWEEN TO_DATE($1, 'YYYY-MM-DD') AND TO_DATE($2, 'YYYY-MM-DD');
        `;
    const mealsQuery = `
        SELECT *
        FROM meals
        WHERE uid=$3 AND TO_DATE(date, 'YYYY-MM-DD') BETWEEN TO_DATE($1, 'YYYY-MM-DD') AND TO_DATE($2, 'YYYY-MM-DD');
        `;  
     try {
        const client = await pool.connect();

        // Fetch tuition data
        const tuitionResult = await client.query(tuitionQuery, [startDate,endDate,studentId]);
        const tuition= tuitionResult.rows||[];
        // Fetch meals data
        const mealsResult = await client.query(mealsQuery, [startDate,endDate,studentId]);
        const meals= mealsResult.rows||[];
        
        const totalTuitionCost = tuition.reduce((total, item) => Number(total) + Number(item.charge), 0) || 0;
        const totalMealCost = meals.reduce((total, item) => Number(total) + Number(item.charge), 0) || 0;
        const totalExpenses = totalTuitionCost + totalMealCost;
        // Close the connection
        client.release();

        // Process the data and render the template
        res.render('pages/student_monthly', { user,studentId, tuition: tuition, meals: meals, selectedMonth, totalTuitionCost, totalMealCost, totalExpenses });
     }
     catch{
       res.redirect(`/student/${studentId}`);
     }
  })
  .post('/add-pay/:id', async (req, res) => {
    const employeeId = req.params.id;
    const { payCharge, payDate } = req.body;

    try {
        const client = await pool.connect();
        await client.query(
            'INSERT INTO salaries (uid, charge, date) VALUES ($1, $2, $3)',
            [employeeId, payCharge, payDate]
        );

        res.redirect(`/employee/${employeeId}?message=Pay%20Stub%20Added&id=${employeeId}`);
        client.release();
    } catch (error) {
        console.error('Error adding pay stub:', error);
        res.redirect(`/employee/${employeeId}?message=Error%20Adding%20Pay%20Stub&id=${employeeId}`);
    }
})
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))

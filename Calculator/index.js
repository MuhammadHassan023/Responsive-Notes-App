const express = require('express');
const session = require('express-session');
const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// Session settings
app.use(session({ 
    secret: 'super-hisaab-key', 
    resave: false, 
    saveUninitialized: true 
}));

// --- DATA (Simple Arrays) ---
let adminData = {
    username: "admin",
    password: "admin123"
};

let users = [
    { id: 1, name: 'hassan', password: '123', role: 'user', isActive: true },
    { id: 2, name: 'ahmad', password: '123', role: 'user', isActive: true },
    { id: 3, name: 'zohaib', password: '123', role: 'user', isActive: true }
];

let expenses = [];

// --- MIDDLEWARES (Security) ---
const isAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).send("Sirf Admin yahan aa sakta hai!");
    }
};

// --- LOGIN & LOGOUT ---

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    let nameInput = req.body.name.toLowerCase();
    let passInput = req.body.password;

    // User ko dhoondo
    let foundUser = users.find(u => u.name === nameInput && u.password === passInput);

    if (foundUser) {
        if (foundUser.isActive === false) {
            return res.render('login', { error: "Aapka account block hai!" });
        }
        req.session.user = foundUser;
        res.redirect('/');
    } else {
        res.render('login', { error: "Ghalat Username ya Password!" });
    }
});

app.get('/admin-login', (req, res) => {
    res.render('admin-login', { error: null });
});

app.post('/admin-login', (req, res) => {
    let user = req.body.username;
    let pass = req.body.password;

    if (user === adminData.username && pass === adminData.password) {
        req.session.user = { id: 'admin', name: adminData.username, role: 'admin' };
        res.redirect('/admin');
    } else {
        res.render('admin-login', { error: "Admin details sahi nahi hain!" });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --- USER DASHBOARD (Main Page) ---

app.get('/', isAuth, (req, res) => {
    if (req.session.user.role === 'admin') return res.redirect('/admin');

    let currentUser = req.session.user.name.toLowerCase();
    let mySpent = 0;   // Mera kharcha
    let leneHain = 0;  // Owed to me
    let deneHain = 0;  // I owe

    // Simple loop for calculation (No complex filters)
    for (let i = 0; i < expenses.length; i++) {
        let exp = expenses[i];
        let share = exp.amount / exp.splitAmong;

        for (let j = 0; j < exp.splits.length; j++) {
            let person = exp.splits[j];

            if (person.name.toLowerCase() === currentUser) {
                mySpent += share; // Kharcha to mera hai hi

                // Agar bill maine nahi bhara aur abhi tak paise bhi nahi diye
                if (exp.paidBy.toLowerCase() !== currentUser && person.isPaid === false) {
                    deneHain += share;
                }
            }

            // Agar bill MAINE bhara hai aur dusre ne nahi diye
            if (exp.paidBy.toLowerCase() === currentUser && person.name.toLowerCase() !== currentUser) {
                if (person.isPaid === false) {
                    leneHain += share;
                }
            }
        }
    }

    res.render('index', { 
        expenses: expenses, 
        myPersonalSpent: mySpent, 
        youAreOwed: leneHain, 
        youOwe: deneHain, 
        user: req.session.user 
    });
});

// --- PROFILE SETTINGS (Dynamic) ---

app.get('/profile', isAuth, (req, res) => {
    let currentUser = users.find(u => u.id == req.session.user.id);
    res.render('profile', { user: currentUser });
});

app.post('/profile/update', isAuth, (req, res) => {
    let newName = req.body.newName.toLowerCase();
    let newPass = req.body.newPassword;
    let oldName = req.session.user.name.toLowerCase();

    let user = users.find(u => u.id == req.session.user.id);

    if (user) {
        user.name = newName;
        user.password = newPass;

        // Billing mein bhi purana naam update kar do
        for (let exp of expenses) {
            if (exp.paidBy.toLowerCase() === oldName) exp.paidBy = newName;
            for (let s of exp.splits) {
                if (s.name.toLowerCase() === oldName) s.name = newName;
            }
        }

        req.session.user = user;
        res.redirect('/profile?success=true');
    }
});

// --- ADMIN CONTROL PANEL ---

app.get('/admin', isAdmin, (req, res) => {
    res.render('admin', { users: users, adminData: adminData, user: req.session.user });
});

app.post('/admin/add-user', isAdmin, (req, res) => {
    let newUser = {
        id: Date.now(),
        name: req.body.name.toLowerCase(),
        password: req.body.password,
        role: 'user',
        isActive: true
    };
    users.push(newUser);
    res.redirect('/admin');
});

app.post('/admin/toggle-status/:id', isAdmin, (req, res) => {
    let id = req.params.id;
    let user = users.find(u => u.id == id);
    if (user) {
        user.isActive = !user.isActive; // Block/Unblock toggle
    }
    res.redirect('/admin');
});

// --- EXPENSE HANDLING ---

app.get('/add', isAuth, (req, res) => {
    res.render('add-expense', { user: req.session.user });
});

app.post('/add', isAuth, (req, res) => {
    let title = req.body.title;
    let amount = parseFloat(req.body.amount);
    let friendsInput = req.body.friends;
    let creator = req.session.user.name;

    // Friends ki list banao
    let names = friendsInput.split(',').map(n => n.trim());
    if (!names.includes(creator)) names.push(creator);

    // Splits data structure
    let finalSplits = [];
    for (let name of names) {
        finalSplits.push({
            name: name,
            isPaid: (name.toLowerCase() === creator.toLowerCase()) // Jisne add kiya uska paid hai
        });
    }

    expenses.push({
        id: Date.now(),
        title: title,
        amount: amount,
        paidBy: creator,
        splitAmong: names.length,
        splits: finalSplits
    });

    res.redirect('/');
});

app.post('/mark-paid/:expId/:name', isAuth, (req, res) => {
    let expId = req.params.expId;
    let personName = req.params.name;

    let bill = expenses.find(e => e.id == expId);
    if (bill) {
        let entry = bill.splits.find(s => s.name.toLowerCase() === personName.toLowerCase());
        if (entry) entry.isPaid = true;
    }
    res.redirect('/');
});

app.listen(3000, () => {
    console.log("Hisaab Kitaab App chal rahi hai: http://localhost:3000");
});
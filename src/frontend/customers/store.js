var Reflux = require('reflux');
var io = require('socket.io-client');
var socket = io();
var console = require('console-browserify');
var CreateStateActions = require('./actions').CreateState;

var CreateState = Reflux.createStore({
  listenables: [require('./actions').CreateState],

  getInitialState: function () {
    return false;
  },

  onOpen: function () {
    this.trigger(true);
  },

  onClose: function () {
    this.trigger(false);
  }
});

var Customers = Reflux.createStore({
  listenables: [require('./actions').Customers],

  init: function () {
    // Fetch customers on initial load.
    console.log('Initialize customer store.');
    socket.on('read customers', this.updateList.bind(this));
  },

  getInitialState: function () {
    this.list = this.list || [];
    return this.list;
  },

  // Indicate the given customer is being edited in the UI.
  onEdit: function (id) {
    this.updateWithID(id, function (customer) {
      customer.editing = true;
      return customer;
    });
  },

  onStopEditing: function (id) {
    this.updateWithID(id, function (customer) {
      customer.editing = false;
      return customer;
    });
  },

  onUpdate: function (customer) {
    // Tell the socket we want to update the customers list.
    customer.saving = true;

    console.log('Preparing to update customer', customer);

    socket.emit(
      'update customer',
      customer, function (err, message) {
        console.log('\tUpdate customer returned', customer, err, message);

        if (err) {
          // TODO: Handle errors...
        }

        this.updateWithID(customer.id, function (cust, index, arr) {
          cust = customer;
          cust.saving = false;
          cust.editing = false;
          arr[index] = cust;
          console.log('\tUpdated customer:', cust);
        });
      }.bind(this)
    );
  },

  onCreate: function (customer) {
    console.log('Create customer:', customer);

    // Immediately display the customer with
    // a loading message while we wait for the
    // server.
    customer.saving = true;
    this.list.push(customer);
    this.updateList(this.list);

    // Tell the server to save the customer.
    socket.emit(
      'create customer',
      customer,
      function (err, newCustomer) {
        if (err) {
          // TODO: Handle errors...
        }

        console.log('\tNew customer returned', customer, err, newCustomer);

        this.list.forEach(function (cust, index, arr) {
          if (cust === customer) {
            console.log('\tUpdating existing customer', cust, 'with', customer);
            newCustomer.saving = false;
            newCustomer.editing = false;
            arr[index] = newCustomer;
          }
        });

        // Close the create dialog when save succeeds.
        CreateStateActions.close();

        this.updateList(this.list);

        console.log('\tCreate customer', customer);
      }.bind(this)
    );
  },

  onDestroy: function (id) {
    console.log('destroy customer:', id);

    socket.emit(
      'destroy customer',
      id,
      function (err, message) {
        if (err) {
          // TODO: Handle errors...
        }

        this.updateWithID(id, function (cust, index, arr) {
          arr.splice(index, 1);
        });
      }.bind(this)
    );
  },

  updateList: function (list) {
    this.list = list;
    this.trigger(list);
  },

  updateWithID: function (id, callback) {
    this.list.forEach(function (customer, index, arr) {
      if (customer.id === id) {
        callback(customer, index, arr);
      }
    });

    this.updateList(this.list);
  }
});

module.exports = {
  CreateState: CreateState,
  Customers: Customers
};

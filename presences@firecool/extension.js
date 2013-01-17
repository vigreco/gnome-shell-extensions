const Lang = imports.lang;
const GnomeSession = imports.misc.gnomeSession;
const Tp = imports.gi.TelepathyGLib;
const IMStatus = imports.ui.userMenu.IMStatus;

// check if GNOME 3.4 or 3.6
if(imports.ui.main.panel._statusArea != null) {
    var statusChooser = imports.ui.main.panel._statusArea.userMenu._statusChooser;
} else {
    var statusChooser = imports.ui.main.panel.statusArea.userMenu._statusChooser;
}


function init() {}

let orig_changeIMStatus = statusChooser._changeIMStatus;
let orig_setComboboxPresence = statusChooser._setComboboxPresence;
let orig_sessionStatusChanged = statusChooser._sessionStatusChanged;
let comboOpenStateId;


function getComboItemChangedSignalId() {
    let connections = statusChooser._combo._signalConnections;
    for (i in connections)
        if ( connections[i]['name'] == 'active-item-changed')
            return connections[i]['id'];
}

function enable() {
    statusChooser._combo.disconnect( getComboItemChangedSignalId() );

    statusChooser._changeIMStatus = function(menuItem, id) {

        let [presence, s, msg] = this._accountMgr.get_most_available_presence();
        let newPresence, status;

        if (id == IMStatus.AVAILABLE) {
            newPresence = Tp.ConnectionPresenceType.AVAILABLE;
        } else if (id == IMStatus.BUSY) {
            newPresence = Tp.ConnectionPresenceType.BUSY;
        } else if (id == IMStatus.HIDDEN) {
            newPresence = Tp.ConnectionPresenceType.HIDDEN;
        } else if (id == IMStatus.AWAY) {
            newPresence = Tp.ConnectionPresenceType.AWAY;
        } else if (id == IMStatus.IDLE) {
            newPresence = Tp.ConnectionPresenceType.EXTENDED_AWAY;
        } else if (id == IMStatus.OFFLINE) {
            newPresence = Tp.ConnectionPresenceType.OFFLINE;
        } else
            return;

        status = this._statusForPresence(newPresence);
        msg = msg ? msg : '';
        this._accountMgr.set_all_requested_presences(newPresence, status, msg);
    };

    statusChooser._setComboboxPresence = function(presence) {
        let activatedItem;

        if (presence == Tp.ConnectionPresenceType.AVAILABLE)
            activatedItem = IMStatus.AVAILABLE;
        else if (presence == Tp.ConnectionPresenceType.BUSY)
            activatedItem = IMStatus.BUSY;
        else if (presence == Tp.ConnectionPresenceType.HIDDEN)
            activatedItem = IMStatus.HIDDEN;
        else if (presence == Tp.ConnectionPresenceType.AWAY)
            activatedItem = IMStatus.AWAY;
        else if (presence == Tp.ConnectionPresenceType.EXTENDED_AWAY)
            activatedItem = IMStatus.IDLE;
        else
            activatedItem = IMStatus.OFFLINE;

        this._combo.setActiveItem(activatedItem);
    };

    statusChooser._sessionStatusChanged = function(sessionStatus) {
        if (!this._imPresenceRestored)
            return;

        let savedStatus = global.settings.get_int('saved-session-presence');
        if (!this._sessionPresenceRestored) {

            savedStatus = GnomeSession.PresenceStatus.AVAILABLE;

            if (sessionStatus != savedStatus) {
                this._presence.status = savedStatus;
                return;
            }

            this._sessionPresenceRestored = true;
        }

        if (savedStatus != sessionStatus)
            global.settings.set_int('saved-session-presence', sessionStatus);

        let [presence, s, msg] = this._accountMgr.get_most_available_presence();
        let newPresence, status;

        let newPresence = this.getIMPresenceForSessionStatus(sessionStatus);

        if (!newPresence || newPresence == presence)
            return;

        status = this._statusForPresence(newPresence);
        msg = msg ? msg : '';

        this._expectedPresence = newPresence;
        this._accountMgr.set_all_requested_presences(newPresence, status, msg);
    };

    statusChooser._combo.connect('active-item-changed',
                        Lang.bind(statusChooser, statusChooser._changeIMStatus));

    comboOpenStateId = statusChooser._combo._menu.connect('open-state-changed', 
        function(self, open) { 
            if (open) {
                let [sourceX, sourceY] = self.sourceActor.get_transformed_position();
                self.actor.set_position(sourceX, sourceY);
            }
        }
    );

    for (let i = 0; i < IMStatus.LAST; i++) {
        statusChooser._combo.setItemVisible(i, true);
    }
}

function disable() {

    statusChooser._combo.disconnect( getComboItemChangedSignalId() );

    statusChooser._sessionStatusChanged = orig_sessionStatusChanged;
    statusChooser._setComboboxPresence = orig_setComboboxPresence;
    statusChooser._changeIMStatus = orig_changeIMStatus;

    statusChooser._combo.connect('active-item-changed',
                        Lang.bind(statusChooser, statusChooser._changeIMStatus));

    statusChooser._setComboboxPresence(statusChooser._currentPresence);

    statusChooser._combo._menu.disconnect(comboOpenStateId);
}


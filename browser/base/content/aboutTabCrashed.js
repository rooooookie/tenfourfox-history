/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var AboutTabCrashed = {
  /**
   * This can be set to true once this page receives a message from the
   * parent saying whether or not a crash report is available.
   */
  hasReport: false,

  /**
   * The messages that we might receive from the parent.
   */
  MESSAGES: [
    "SetCrashReportAvailable",
    "CrashReportSent",
    "UpdateCount",
  ],

  /**
   * Items for which we will listen for click events.
   */
  CLICK_TARGETS: [
    "closeTab",
    "restoreTab",
    "restoreAll",
    "sendReport",
  ],

  /**
   * Returns information about this crashed tab.
   *
   * @return (Object) An object with the following properties:
   *           title (String):
   *             The title of the page that crashed.
   *           URL (String):
   *             The URL of the page that crashed.
   */
  get pageData() {
    delete this.pageData;

    let URL = document.documentURI;
    let queryString = URL.replace(/^about:tabcrashed?e=tabcrashed/, "");

    let titleMatch = queryString.match(/d=([^&]*)/);
    let URLMatch = queryString.match(/u=([^&]*)/);

    return this.pageData = {
      title: titleMatch && titleMatch[1] ? decodeURIComponent(titleMatch[1]) : "",
      URL: URLMatch && URLMatch[1] ? decodeURIComponent(URLMatch[1]) : "",
    };
  },

  init() {
    this.MESSAGES.forEach((msg) => addMessageListener(msg, this.receiveMessage.bind(this)));
    addEventListener("DOMContentLoaded", this);

    document.title = this.pageData.title;
  },

  receiveMessage(message) {
    switch(message.name) {
      case "UpdateCount": {
        this.showRestoreAll(message.data.count > 1);
        break;
      }
      case "SetCrashReportAvailable": {
        this.onSetCrashReportAvailable(message);
        break;
      }
      case "CrashReportSent": {
        this.onCrashReportSent();
        break;
      }
    }
  },

  handleEvent(event) {
    switch (event.type) {
      case "DOMContentLoaded": {
        this.onDOMContentLoaded();
        break;
      }
      case "click": {
        this.onClick(event);
        break;
      }
    }
  },

  onDOMContentLoaded() {
    this.CLICK_TARGETS.forEach((targetID) => {
      let el = document.getElementById(targetID);
      el.addEventListener("click", this);
    });

    // Error pages are loaded as LOAD_BACKGROUND, so they don't get load events.
    let event = new CustomEvent("AboutTabCrashedLoad", {bubbles:true});
    document.dispatchEvent(event);

    sendAsyncMessage("Load");
  },

  onClick(event) {
    switch(event.target.id) {
      case "closeTab": {
        this.sendMessage("closeTab");
        break;
      }

      case "restoreTab": {
        this.sendMessage("restoreTab");
        break;
      }

      case "restoreAll": {
        this.sendMessage("restoreAll");
        break;
      }

      case "sendReport": {
        this.showCrashReportUI(event.target.checked);
        break;
      }
    }
  },

  /**
   * After this page tells the parent that it has loaded, the parent
   * will respond with whether or not a crash report is available. This
   * method handles that message.
   *
   * @param message
   *        The message from the parent, which should contain a data
   *        Object property with the following properties:
   *
   *        hasReport (bool):
   *          Whether or not there is a crash report
   *
   *        sendReport (bool):
   *          Whether or not the the user prefers to send the report
   *          by default
   *
   *        includeURL (bool):
   *          Whether or not the user prefers to send the URL of
   *          the tab that crashed.
   *
   *        emailMe (bool):
   *          Whether or not to send the email address of the user
   *          in the report.
   *
   *        email (String):
   *          The email address of the user (empty if emailMe is false)
   *
   */
  onSetCrashReportAvailable(message) {
    if (message.data.hasReport) {
      this.hasReport = true;
      document.documentElement.classList.add("crashDumpAvailable");

      let data = message.data;
      document.getElementById("sendReport").checked = data.sendReport;
      document.getElementById("includeURL").checked = data.includeURL;
      document.getElementById("emailMe").checked = data.emailMe;
      if (data.emailMe) {
        document.getElementById("email").value = data.email;
      }
    }

    let event = new CustomEvent("AboutTabCrashedReady", {bubbles:true});
    document.dispatchEvent(event);
  },

  /**
   * Handler for when the parent reports that the crash report associated
   * with this about:tabcrashed page has been sent.
   */
  onCrashReportSent() {
    document.documentElement.classList.remove("crashDumpAvailable");
    document.documentElement.classList.add("crashDumpSubmitted");
  },

  /**
   * Toggles the display of the crash report form.
   *
   * @param shouldShow (bool)
   *        True if the crash report form should be shown
   */
  showCrashReportUI(shouldShow) {
    let container = document.getElementById("crash-reporter-container");
    container.hidden = !shouldShow;
  },

  /**
   * Toggles the display of the "Restore All" button.
   *
   * @param shouldShow (bool)
   *        True if the "Restore All" button should be shown
   */
  showRestoreAll(shouldShow) {
    let restoreAll = document.getElementById("restoreAll");
    let restoreTab = document.getElementById("restoreTab");
    if (shouldShow) {
      restoreAll.removeAttribute("hidden");
      restoreTab.classList.remove("primary");
    } else {
      restoreAll.setAttribute("hidden", true);
      restoreTab.classList.add("primary");
    }
  },

  /**
   * Sends a message to the parent in response to the user choosing
   * one of the actions available on the page. This might also send up
   * crash report information if the user has chosen to submit a crash
   * report.
   *
   * @param messageName (String)
   *        The message to send to the parent
   */
  sendMessage(messageName) {
    let comments = "";
    let email = "";
    let URL = "";
    let sendReport = false;
    let emailMe = false;
    let includeURL = false;

    if (this.hasReport) {
      sendReport = document.getElementById("sendReport").checked;
      if (sendReport) {
        comments = document.getElementById("comments").value.trim();

        includeURL = document.getElementById("includeURL").checked;
        if (includeURL) {
          URL = this.pageData.URL.trim();
        }

        emailMe = document.getElementById("emailMe").checked;
        if (emailMe) {
          email = document.getElementById("email").value.trim();
        }
      }
    }

    sendAsyncMessage(messageName, {
      sendReport,
      comments,
      email,
      emailMe,
      includeURL,
      URL,
    });
  },
};

AboutTabCrashed.init();
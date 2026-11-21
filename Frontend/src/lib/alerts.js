import Swal from "sweetalert2";

const palette = {
  background: "#fbfaf5",
  color: "#202820",
  confirmButtonColor: "#253526",
  cancelButtonColor: "#e8eadf",
};

export function showError(message) {
  return Swal.fire({
    ...palette,
    icon: "error",
    title: "Something went wrong",
    text: message || "Please try again.",
    confirmButtonText: "Got it",
  });
}

export function showSuccess(message) {
  return Swal.fire({
    ...palette,
    icon: "success",
    title: message,
    timer: 1800,
    showConfirmButton: false,
  });
}

export function confirmAction({ title, text, confirmText = "Continue", icon = "warning" }) {
  return Swal.fire({
    ...palette,
    icon,
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancel",
    cancelButtonColor: palette.cancelButtonColor,
    reverseButtons: true,
    focusCancel: true,
  });
}

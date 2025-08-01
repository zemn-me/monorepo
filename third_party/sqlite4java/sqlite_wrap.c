/* ----------------------------------------------------------------------------
 * This file was automatically generated by SWIG (https://www.swig.org).
 * Version 4.1.1
 *
 * Do not make changes to this file unless you know what you are doing - modify
 * the SWIG interface file instead.
 * ----------------------------------------------------------------------------- */


#define SWIG_VERSION 0x040101
#define SWIGJAVA

/* -----------------------------------------------------------------------------
 *  This section contains generic SWIG labels for method/variable
 *  declarations/attributes, and other compiler dependent labels.
 * ----------------------------------------------------------------------------- */

/* template workaround for compilers that cannot correctly implement the C++ standard */
#ifndef SWIGTEMPLATEDISAMBIGUATOR
# if defined(__SUNPRO_CC) && (__SUNPRO_CC <= 0x560)
#  define SWIGTEMPLATEDISAMBIGUATOR template
# elif defined(__HP_aCC)
/* Needed even with `aCC -AA' when `aCC -V' reports HP ANSI C++ B3910B A.03.55 */
/* If we find a maximum version that requires this, the test would be __HP_aCC <= 35500 for A.03.55 */
#  define SWIGTEMPLATEDISAMBIGUATOR template
# else
#  define SWIGTEMPLATEDISAMBIGUATOR
# endif
#endif

/* inline attribute */
#ifndef SWIGINLINE
# if defined(__cplusplus) || (defined(__GNUC__) && !defined(__STRICT_ANSI__))
#   define SWIGINLINE inline
# else
#   define SWIGINLINE
# endif
#endif

/* attribute recognised by some compilers to avoid 'unused' warnings */
#ifndef SWIGUNUSED
# if defined(__GNUC__)
#   if !(defined(__cplusplus)) || (__GNUC__ > 3 || (__GNUC__ == 3 && __GNUC_MINOR__ >= 4))
#     define SWIGUNUSED __attribute__ ((__unused__))
#   else
#     define SWIGUNUSED
#   endif
# elif defined(__ICC)
#   define SWIGUNUSED __attribute__ ((__unused__))
# else
#   define SWIGUNUSED
# endif
#endif

#ifndef SWIG_MSC_UNSUPPRESS_4505
# if defined(_MSC_VER)
#   pragma warning(disable : 4505) /* unreferenced local function has been removed */
# endif
#endif

#ifndef SWIGUNUSEDPARM
# ifdef __cplusplus
#   define SWIGUNUSEDPARM(p)
# else
#   define SWIGUNUSEDPARM(p) p SWIGUNUSED
# endif
#endif

/* internal SWIG method */
#ifndef SWIGINTERN
# define SWIGINTERN static SWIGUNUSED
#endif

/* internal inline SWIG method */
#ifndef SWIGINTERNINLINE
# define SWIGINTERNINLINE SWIGINTERN SWIGINLINE
#endif

/* exporting methods */
#if defined(__GNUC__)
#  if (__GNUC__ >= 4) || (__GNUC__ == 3 && __GNUC_MINOR__ >= 4)
#    ifndef GCC_HASCLASSVISIBILITY
#      define GCC_HASCLASSVISIBILITY
#    endif
#  endif
#endif

#ifndef SWIGEXPORT
# if defined(_WIN32) || defined(__WIN32__) || defined(__CYGWIN__)
#   if defined(STATIC_LINKED)
#     define SWIGEXPORT
#   else
#     define SWIGEXPORT __declspec(dllexport)
#   endif
# else
#   if defined(__GNUC__) && defined(GCC_HASCLASSVISIBILITY)
#     define SWIGEXPORT __attribute__ ((visibility("default")))
#   else
#     define SWIGEXPORT
#   endif
# endif
#endif

/* calling conventions for Windows */
#ifndef SWIGSTDCALL
# if defined(_WIN32) || defined(__WIN32__) || defined(__CYGWIN__)
#   define SWIGSTDCALL __stdcall
# else
#   define SWIGSTDCALL
# endif
#endif

/* Deal with Microsoft's attempt at deprecating C standard runtime functions */
#if !defined(SWIG_NO_CRT_SECURE_NO_DEPRECATE) && defined(_MSC_VER) && !defined(_CRT_SECURE_NO_DEPRECATE)
# define _CRT_SECURE_NO_DEPRECATE
#endif

/* Deal with Microsoft's attempt at deprecating methods in the standard C++ library */
#if !defined(SWIG_NO_SCL_SECURE_NO_DEPRECATE) && defined(_MSC_VER) && !defined(_SCL_SECURE_NO_DEPRECATE)
# define _SCL_SECURE_NO_DEPRECATE
#endif

/* Deal with Apple's deprecated 'AssertMacros.h' from Carbon-framework */
#if defined(__APPLE__) && !defined(__ASSERT_MACROS_DEFINE_VERSIONS_WITHOUT_UNDERSCORES)
# define __ASSERT_MACROS_DEFINE_VERSIONS_WITHOUT_UNDERSCORES 0
#endif

/* Intel's compiler complains if a variable which was never initialised is
 * cast to void, which is a common idiom which we use to indicate that we
 * are aware a variable isn't used.  So we just silence that warning.
 * See: https://github.com/swig/swig/issues/192 for more discussion.
 */
#ifdef __INTEL_COMPILER
# pragma warning disable 592
#endif


#include <jni.h>
#include <stdlib.h>
#include <string.h>


/* Support for throwing Java exceptions */
typedef enum {
  SWIG_JavaOutOfMemoryError = 1,
  SWIG_JavaIOException,
  SWIG_JavaRuntimeException,
  SWIG_JavaIndexOutOfBoundsException,
  SWIG_JavaArithmeticException,
  SWIG_JavaIllegalArgumentException,
  SWIG_JavaNullPointerException,
  SWIG_JavaDirectorPureVirtual,
  SWIG_JavaUnknownError,
  SWIG_JavaIllegalStateException,
} SWIG_JavaExceptionCodes;

typedef struct {
  SWIG_JavaExceptionCodes code;
  const char *java_exception;
} SWIG_JavaExceptions_t;


static void SWIGUNUSED SWIG_JavaThrowException(JNIEnv *jenv, SWIG_JavaExceptionCodes code, const char *msg) {
  jclass excep;
  static const SWIG_JavaExceptions_t java_exceptions[] = {
    { SWIG_JavaOutOfMemoryError, "java/lang/OutOfMemoryError" },
    { SWIG_JavaIOException, "java/io/IOException" },
    { SWIG_JavaRuntimeException, "java/lang/RuntimeException" },
    { SWIG_JavaIndexOutOfBoundsException, "java/lang/IndexOutOfBoundsException" },
    { SWIG_JavaArithmeticException, "java/lang/ArithmeticException" },
    { SWIG_JavaIllegalArgumentException, "java/lang/IllegalArgumentException" },
    { SWIG_JavaNullPointerException, "java/lang/NullPointerException" },
    { SWIG_JavaDirectorPureVirtual, "java/lang/RuntimeException" },
    { SWIG_JavaUnknownError,  "java/lang/UnknownError" },
    { SWIG_JavaIllegalStateException, "java/lang/IllegalStateException" },
    { (SWIG_JavaExceptionCodes)0,  "java/lang/UnknownError" }
  };
  const SWIG_JavaExceptions_t *except_ptr = java_exceptions;

  while (except_ptr->code != code && except_ptr->code)
    except_ptr++;

  (*jenv)->ExceptionClear(jenv);
  excep = (*jenv)->FindClass(jenv, except_ptr->java_exception);
  if (excep)
    (*jenv)->ThrowNew(jenv, excep, msg);
}


/* Contract support */

#define SWIG_contract_assert(nullreturn, expr, msg) do { if (!(expr)) {SWIG_JavaThrowException(jenv, SWIG_JavaIllegalArgumentException, msg); return nullreturn; } } while (0)


#include <sqlite3.h>


#ifdef __cplusplus
extern "C" {
#endif

SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1initialize(JNIEnv *jenv, jclass jcls) {
  jint jresult = 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  result = (int)sqlite3_initialize();
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1shutdown(JNIEnv *jenv, jclass jcls) {
  jint jresult = 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  result = (int)sqlite3_shutdown();
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1extended_1errcode(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3 *arg1 = (sqlite3 *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  result = (int)sqlite3_extended_errcode(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jstring JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1libversion(JNIEnv *jenv, jclass jcls) {
  jstring jresult = 0 ;
  char *result = 0 ;

  (void)jenv;
  (void)jcls;
  result = (char *)sqlite3_libversion();
  if (result) jresult = (*jenv)->NewStringUTF(jenv, (const char *)result);
  return jresult;
}


SWIGEXPORT jstring JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1sourceid(JNIEnv *jenv, jclass jcls) {
  jstring jresult = 0 ;
  char *result = 0 ;

  (void)jenv;
  (void)jcls;
  result = (char *)sqlite3_sourceid();
  if (result) jresult = (*jenv)->NewStringUTF(jenv, (const char *)result);
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1libversion_1number(JNIEnv *jenv, jclass jcls) {
  jint jresult = 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  result = (int)sqlite3_libversion_number();
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1compileoption_1used(JNIEnv *jenv, jclass jcls, jstring jarg1) {
  jint jresult = 0 ;
  char *arg1 = (char *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = 0;
  if (jarg1) {
    arg1 = (char *)(*jenv)->GetStringUTFChars(jenv, jarg1, 0);
    if (!arg1) return 0;
  }
  result = (int)sqlite3_compileoption_used((char const *)arg1);
  jresult = (jint)result;
  if (arg1) (*jenv)->ReleaseStringUTFChars(jenv, jarg1, (const char *)arg1);
  return jresult;
}


SWIGEXPORT jstring JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1compileoption_1get(JNIEnv *jenv, jclass jcls, jint jarg1) {
  jstring jresult = 0 ;
  int arg1 ;
  char *result = 0 ;

  (void)jenv;
  (void)jcls;
  arg1 = (int)jarg1;
  result = (char *)sqlite3_compileoption_get(arg1);
  if (result) jresult = (*jenv)->NewStringUTF(jenv, (const char *)result);
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1threadsafe(JNIEnv *jenv, jclass jcls) {
  jint jresult = 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  result = (int)sqlite3_threadsafe();
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1close(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3 *arg1 = (sqlite3 *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  result = (int)sqlite3_close(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1extended_1result_1codes(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2) {
  jint jresult = 0 ;
  sqlite3 *arg1 = (sqlite3 *) 0 ;
  int arg2 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  arg2 = (int)jarg2;
  result = (int)sqlite3_extended_result_codes(arg1,arg2);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jlong JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1last_1insert_1rowid(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jlong jresult = 0 ;
  sqlite3 *arg1 = (sqlite3 *) 0 ;
  sqlite3_int64 result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  result = (sqlite3_int64)sqlite3_last_insert_rowid(arg1);
  jresult = (jlong)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1changes(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3 *arg1 = (sqlite3 *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  result = (int)sqlite3_changes(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1total_1changes(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3 *arg1 = (sqlite3 *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  result = (int)sqlite3_total_changes(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT void JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1interrupt(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  sqlite3 *arg1 = (sqlite3 *) 0 ;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  sqlite3_interrupt(arg1);
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1complete(JNIEnv *jenv, jclass jcls, jstring jarg1) {
  jint jresult = 0 ;
  char *arg1 = (char *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = 0;
  if (jarg1) {
    arg1 = (char *)(*jenv)->GetStringUTFChars(jenv, jarg1, 0);
    if (!arg1) return 0;
  }
  result = (int)sqlite3_complete((char const *)arg1);
  jresult = (jint)result;
  if (arg1) (*jenv)->ReleaseStringUTFChars(jenv, jarg1, (const char *)arg1);
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1busy_1timeout(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2) {
  jint jresult = 0 ;
  sqlite3 *arg1 = (sqlite3 *) 0 ;
  int arg2 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  arg2 = (int)jarg2;
  result = (int)sqlite3_busy_timeout(arg1,arg2);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jlong JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1memory_1used(JNIEnv *jenv, jclass jcls) {
  jlong jresult = 0 ;
  sqlite3_int64 result;

  (void)jenv;
  (void)jcls;
  result = (sqlite3_int64)sqlite3_memory_used();
  jresult = (jlong)result;
  return jresult;
}


SWIGEXPORT jlong JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1memory_1highwater(JNIEnv *jenv, jclass jcls, jint jarg1) {
  jlong jresult = 0 ;
  int arg1 ;
  sqlite3_int64 result;

  (void)jenv;
  (void)jcls;
  arg1 = (int)jarg1;
  result = (sqlite3_int64)sqlite3_memory_highwater(arg1);
  jresult = (jlong)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1errcode(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3 *arg1 = (sqlite3 *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  result = (int)sqlite3_errcode(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jstring JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1errmsg(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jstring jresult = 0 ;
  sqlite3 *arg1 = (sqlite3 *) 0 ;
  char *result = 0 ;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  result = (char *)sqlite3_errmsg(arg1);
  if (result) jresult = (*jenv)->NewStringUTF(jenv, (const char *)result);
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1bind_1double(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2, jdouble jarg3) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int arg2 ;
  double arg3 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = (int)jarg2;
  arg3 = (double)jarg3;
  result = (int)sqlite3_bind_double(arg1,arg2,arg3);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1bind_1int(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2, jint jarg3) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int arg2 ;
  int arg3 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = (int)jarg2;
  arg3 = (int)jarg3;
  result = (int)sqlite3_bind_int(arg1,arg2,arg3);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1bind_1int64(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2, jlong jarg3) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int arg2 ;
  sqlite3_int64 arg3 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = (int)jarg2;
  arg3 = (sqlite3_int64)jarg3;
  result = (int)sqlite3_bind_int64(arg1,arg2,arg3);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1bind_1null(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int arg2 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = (int)jarg2;
  result = (int)sqlite3_bind_null(arg1,arg2);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1bind_1zeroblob(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2, jint jarg3) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int arg2 ;
  int arg3 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = (int)jarg2;
  arg3 = (int)jarg3;
  result = (int)sqlite3_bind_zeroblob(arg1,arg2,arg3);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1bind_1parameter_1count(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  result = (int)sqlite3_bind_parameter_count(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jstring JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1bind_1parameter_1name(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2) {
  jstring jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int arg2 ;
  char *result = 0 ;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = (int)jarg2;
  result = (char *)sqlite3_bind_parameter_name(arg1,arg2);
  if (result) jresult = (*jenv)->NewStringUTF(jenv, (const char *)result);
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1bind_1parameter_1index(JNIEnv *jenv, jclass jcls, jlong jarg1, jstring jarg2) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  char *arg2 = (char *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = 0;
  if (jarg2) {
    arg2 = (char *)(*jenv)->GetStringUTFChars(jenv, jarg2, 0);
    if (!arg2) return 0;
  }
  result = (int)sqlite3_bind_parameter_index(arg1,(char const *)arg2);
  jresult = (jint)result;
  if (arg2) (*jenv)->ReleaseStringUTFChars(jenv, jarg2, (const char *)arg2);
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1clear_1bindings(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  result = (int)sqlite3_clear_bindings(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1column_1count(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  result = (int)sqlite3_column_count(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jstring JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1column_1name(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2) {
  jstring jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int arg2 ;
  char *result = 0 ;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = (int)jarg2;
  result = (char *)sqlite3_column_name(arg1,arg2);
  if (result) jresult = (*jenv)->NewStringUTF(jenv, (const char *)result);
  return jresult;
}


SWIGEXPORT jstring JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1column_1database_1name(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2) {
  jstring jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int arg2 ;
  char *result = 0 ;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = (int)jarg2;
  result = (char *)sqlite3_column_database_name(arg1,arg2);
  if (result) jresult = (*jenv)->NewStringUTF(jenv, (const char *)result);
  return jresult;
}


SWIGEXPORT jstring JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1column_1table_1name(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2) {
  jstring jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int arg2 ;
  char *result = 0 ;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = (int)jarg2;
  result = (char *)sqlite3_column_table_name(arg1,arg2);
  if (result) jresult = (*jenv)->NewStringUTF(jenv, (const char *)result);
  return jresult;
}


SWIGEXPORT jstring JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1column_1origin_1name(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2) {
  jstring jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int arg2 ;
  char *result = 0 ;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = (int)jarg2;
  result = (char *)sqlite3_column_origin_name(arg1,arg2);
  if (result) jresult = (*jenv)->NewStringUTF(jenv, (const char *)result);
  return jresult;
}


SWIGEXPORT jstring JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1column_1decltype(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2) {
  jstring jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int arg2 ;
  char *result = 0 ;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = (int)jarg2;
  result = (char *)sqlite3_column_decltype(arg1,arg2);
  if (result) jresult = (*jenv)->NewStringUTF(jenv, (const char *)result);
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1step(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  result = (int)sqlite3_step(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1data_1count(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  result = (int)sqlite3_data_count(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jdouble JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1column_1double(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2) {
  jdouble jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int arg2 ;
  double result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = (int)jarg2;
  result = (double)sqlite3_column_double(arg1,arg2);
  jresult = (jdouble)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1column_1int(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int arg2 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = (int)jarg2;
  result = (int)sqlite3_column_int(arg1,arg2);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jlong JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1column_1int64(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2) {
  jlong jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int arg2 ;
  sqlite3_int64 result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = (int)jarg2;
  result = (sqlite3_int64)sqlite3_column_int64(arg1,arg2);
  jresult = (jlong)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1column_1type(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int arg2 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  arg2 = (int)jarg2;
  result = (int)sqlite3_column_type(arg1,arg2);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1finalize(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  result = (int)sqlite3_finalize(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1reset(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  result = (int)sqlite3_reset(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1get_1autocommit(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3 *arg1 = (sqlite3 *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  result = (int)sqlite3_get_autocommit(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jlong JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1db_1handle(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jlong jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  sqlite3 *result = 0 ;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  result = (sqlite3 *)sqlite3_db_handle(arg1);
  *(sqlite3 **)&jresult = result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1enable_1shared_1cache(JNIEnv *jenv, jclass jcls, jint jarg1) {
  jint jresult = 0 ;
  int arg1 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = (int)jarg1;
  result = (int)sqlite3_enable_shared_cache(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1release_1memory(JNIEnv *jenv, jclass jcls, jint jarg1) {
  jint jresult = 0 ;
  int arg1 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = (int)jarg1;
  result = (int)sqlite3_release_memory(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jlong JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1soft_1heap_1limit64(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jlong jresult = 0 ;
  sqlite3_int64 arg1 ;
  sqlite3_int64 result;

  (void)jenv;
  (void)jcls;
  arg1 = (sqlite3_int64)jarg1;
  result = (sqlite3_int64)sqlite3_soft_heap_limit64(arg1);
  jresult = (jlong)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1blob_1close(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3_blob *arg1 = (sqlite3_blob *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_blob **)&jarg1;
  result = (int)sqlite3_blob_close(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1blob_1bytes(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3_blob *arg1 = (sqlite3_blob *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_blob **)&jarg1;
  result = (int)sqlite3_blob_bytes(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1stmt_1readonly(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3_stmt *arg1 = (sqlite3_stmt *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_stmt **)&jarg1;
  result = (int)sqlite3_stmt_readonly(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1blob_1reopen(JNIEnv *jenv, jclass jcls, jlong jarg1, jlong jarg2) {
  jint jresult = 0 ;
  sqlite3_blob *arg1 = (sqlite3_blob *) 0 ;
  sqlite3_int64 arg2 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_blob **)&jarg1;
  arg2 = (sqlite3_int64)jarg2;
  result = (int)sqlite3_blob_reopen(arg1,arg2);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1limit(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2, jint jarg3) {
  jint jresult = 0 ;
  sqlite3 *arg1 = (sqlite3 *) 0 ;
  int arg2 ;
  int arg3 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  arg2 = (int)jarg2;
  arg3 = (int)jarg3;
  result = (int)sqlite3_limit(arg1,arg2,arg3);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jlong JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1backup_1init(JNIEnv *jenv, jclass jcls, jlong jarg1, jstring jarg2, jlong jarg3, jstring jarg4) {
  jlong jresult = 0 ;
  sqlite3 *arg1 = (sqlite3 *) 0 ;
  char *arg2 = (char *) 0 ;
  sqlite3 *arg3 = (sqlite3 *) 0 ;
  char *arg4 = (char *) 0 ;
  sqlite3_backup *result = 0 ;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  arg2 = 0;
  if (jarg2) {
    arg2 = (char *)(*jenv)->GetStringUTFChars(jenv, jarg2, 0);
    if (!arg2) return 0;
  }
  arg3 = *(sqlite3 **)&jarg3;
  arg4 = 0;
  if (jarg4) {
    arg4 = (char *)(*jenv)->GetStringUTFChars(jenv, jarg4, 0);
    if (!arg4) return 0;
  }
  result = (sqlite3_backup *)sqlite3_backup_init(arg1,(char const *)arg2,arg3,(char const *)arg4);
  *(sqlite3_backup **)&jresult = result;
  if (arg2) (*jenv)->ReleaseStringUTFChars(jenv, jarg2, (const char *)arg2);
  if (arg4) (*jenv)->ReleaseStringUTFChars(jenv, jarg4, (const char *)arg4);
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1backup_1step(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2) {
  jint jresult = 0 ;
  sqlite3_backup *arg1 = (sqlite3_backup *) 0 ;
  int arg2 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_backup **)&jarg1;
  arg2 = (int)jarg2;
  result = (int)sqlite3_backup_step(arg1,arg2);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1backup_1finish(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3_backup *arg1 = (sqlite3_backup *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_backup **)&jarg1;
  result = (int)sqlite3_backup_finish(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1backup_1remaining(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3_backup *arg1 = (sqlite3_backup *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_backup **)&jarg1;
  result = (int)sqlite3_backup_remaining(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1backup_1pagecount(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3_backup *arg1 = (sqlite3_backup *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3_backup **)&jarg1;
  result = (int)sqlite3_backup_pagecount(arg1);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1enable_1load_1extension(JNIEnv *jenv, jclass jcls, jlong jarg1, jint jarg2) {
  jint jresult = 0 ;
  sqlite3 *arg1 = (sqlite3 *) 0 ;
  int arg2 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  arg2 = (int)jarg2;
  result = (int)sqlite3_enable_load_extension(arg1,arg2);
  jresult = (jint)result;
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1db_1readonly(JNIEnv *jenv, jclass jcls, jlong jarg1, jstring jarg2) {
  jint jresult = 0 ;
  sqlite3 *arg1 = (sqlite3 *) 0 ;
  char *arg2 = (char *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  arg2 = 0;
  if (jarg2) {
    arg2 = (char *)(*jenv)->GetStringUTFChars(jenv, jarg2, 0);
    if (!arg2) return 0;
  }
  result = (int)sqlite3_db_readonly(arg1,(char const *)arg2);
  jresult = (jint)result;
  if (arg2) (*jenv)->ReleaseStringUTFChars(jenv, jarg2, (const char *)arg2);
  return jresult;
}


SWIGEXPORT jint JNICALL Java_com_almworks_sqlite4java__1SQLiteSwiggedJNI_sqlite3_1db_1cacheflush(JNIEnv *jenv, jclass jcls, jlong jarg1) {
  jint jresult = 0 ;
  sqlite3 *arg1 = (sqlite3 *) 0 ;
  int result;

  (void)jenv;
  (void)jcls;
  arg1 = *(sqlite3 **)&jarg1;
  result = (int)sqlite3_db_cacheflush(arg1);
  jresult = (jint)result;
  return jresult;
}


#ifdef __cplusplus
}
#endif
